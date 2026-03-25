'use strict';

const crypto = require('crypto');

const NUM_GROUP_COLORS = 10;

class ConversationGroupManager {
  constructor(settings, broadcastFn, logger) {
    this._settings = settings;
    this._broadcast = broadcastFn;
    this._logger = logger;
    // userId -> boolean
    this._speakingStates = new Map();
    // userId -> 'conversation'|'standby'
    this._conversationStates = new Map();
    // groupId (UUID) -> {members: Set<userId>, color: number}
    this._groups = new Map();
    // userId -> groupId (absent = unaffiliated)
    this._userGroupId = new Map();
    // userId -> setTimeout ID (excitation timer: speaking stopped -> standby)
    this._excitationTimers = new Map();
    // {timerId, userId} or null (monologue timer: solo speaker -> standby if no response)
    this._monologue = null;
    // Users whose conversation state is held (won't auto-transition to standby).
    this._heldUsers = new Set();
  }

  handleSpeakingStateChange(userId, isSpeaking) {
    const wasSpeaking = this._speakingStates.get(userId) || false;
    this._speakingStates.set(userId, isSpeaking);
    if (isSpeaking && !wasSpeaking) {
      this._onSpeakingStart(userId);
    } else if (!isSpeaking && wasSpeaking) {
      this._onSpeakingStop(userId);
    }
  }

  _onSpeakingStart(userId) {
    this._cancelExcitationTimer(userId);
    this._conversationStates.set(userId, 'conversation');
    this._applyGroupFormationRules(userId);
    this._broadcastState();
  }

  _onSpeakingStop(userId) {
    // Held users don't start excitation timer.
    if (this._heldUsers.has(userId)) return;
    const excitationTime = this._settings.excitationTime || 15000;
    const timerId = setTimeout(() => {
      this._excitationTimers.delete(userId);
      this._handleExcitationExpired(userId);
    }, excitationTime);
    this._excitationTimers.set(userId, timerId);
  }

  _handleExcitationExpired(userId) {
    this._conversationStates.set(userId, 'standby');
    this._removeFromGroup(userId);
    this._broadcastState();
  }

  _applyGroupFormationRules(userId) {
    // If already in a group, stay.
    if (this._userGroupId.has(userId)) return;

    // If someone is in monologue and a different person speaks, form a group.
    if (this._monologue && this._monologue.userId !== userId) {
      this._formGroupFromMonologue(this._monologue.userId, userId);
      return;
    }

    if (this._groups.size === 0) {
      this._startMonologue(userId);
    } else if (this._groups.size === 1) {
      // [rule-1] join the only group.
      const groupId = this._groups.keys().next().value;
      this._addToGroup(userId, groupId);
    } else {
      // Multiple groups: unaffiliated.
    }
  }

  _startMonologue(userId) {
    this._cancelMonologue();
    const monologueTime = this._settings.monologueTime || 10000;
    const timerId = setTimeout(() => {
      this._handleMonologueExpired(userId);
    }, monologueTime);
    this._monologue = {timerId, userId};
  }

  _handleMonologueExpired(userId) {
    this._monologue = null;
    this._conversationStates.set(userId, 'standby');
    this._broadcastState();
  }

  _allocateColor() {
    const usedColors = new Set(
        [...this._groups.values()].map((g) => g.color),
    );
    for (let i = 0; i < NUM_GROUP_COLORS; i++) {
      if (!usedColors.has(i)) return i;
    }
    return 0;
  }

  _createGroup(memberIds) {
    const groupId = crypto.randomUUID();
    const color = this._allocateColor();
    this._groups.set(groupId, {members: new Set(memberIds), color});
    for (const uid of memberIds) {
      this._userGroupId.set(uid, groupId);
    }
    return groupId;
  }

  _formGroupFromMonologue(initiatorId, responderId) {
    this._cancelMonologue();
    this._createGroup([initiatorId, responderId]);
    this._conversationStates.set(initiatorId, 'conversation');
    this._conversationStates.set(responderId, 'conversation');
  }

  _addToGroup(userId, groupId) {
    const group = this._groups.get(groupId);
    if (!group) return;
    group.members.add(userId);
    this._userGroupId.set(userId, groupId);
  }

  _removeFromGroup(userId) {
    const groupId = this._userGroupId.get(userId);
    if (groupId == null) return;
    const group = this._groups.get(groupId);
    if (group) {
      group.members.delete(userId);
      if (group.members.size === 0) {
        this._groups.delete(groupId);
      }
    }
    this._userGroupId.delete(userId);
  }

  handleDesignation(speakerId, targetUserId) {
    // Both must not be in conversation state.
    if (this._conversationStates.get(speakerId) === 'conversation') return;
    if (this._conversationStates.get(targetUserId) === 'conversation') return;

    this._cancelMonologue();
    this._cancelExcitationTimer(speakerId);
    this._cancelExcitationTimer(targetUserId);
    this._conversationStates.set(speakerId, 'conversation');
    this._conversationStates.set(targetUserId, 'conversation');

    this._createGroup([speakerId, targetUserId]);

    // Start excitation timers for users not currently speaking (and not held).
    for (const uid of [speakerId, targetUserId]) {
      if (!this._speakingStates.get(uid) && !this._heldUsers.has(uid)) {
        const excitationTime = this._settings.excitationTime || 15000;
        const timerId = setTimeout(() => {
          this._excitationTimers.delete(uid);
          this._handleExcitationExpired(uid);
        }, excitationTime);
        this._excitationTimers.set(uid, timerId);
      }
    }
    this._broadcastState();
  }

  setHold(userId, held) {
    if (held) {
      this._heldUsers.add(userId);
      this._cancelExcitationTimer(userId);
    } else {
      this._heldUsers.delete(userId);
      if (!this._speakingStates.get(userId)) {
        const excitationTime = this._settings.excitationTime || 15000;
        const timerId = setTimeout(() => {
          this._excitationTimers.delete(userId);
          this._handleExcitationExpired(userId);
        }, excitationTime);
        this._excitationTimers.set(userId, timerId);
      }
    }
    this._broadcastState();
  }

  removeUser(userId) {
    this._cancelExcitationTimer(userId);
    if (this._monologue && this._monologue.userId === userId) {
      this._cancelMonologue();
    }
    this._heldUsers.delete(userId);
    this._speakingStates.delete(userId);
    this._conversationStates.delete(userId);
    this._removeFromGroup(userId);
    this._broadcastState();
  }

  _cancelExcitationTimer(userId) {
    const timerId = this._excitationTimers.get(userId);
    if (timerId != null) {
      clearTimeout(timerId);
      this._excitationTimers.delete(userId);
    }
  }

  _cancelMonologue() {
    if (this._monologue) {
      clearTimeout(this._monologue.timerId);
      this._monologue = null;
    }
  }

  get isEmpty() {
    return this._speakingStates.size === 0 && this._conversationStates.size === 0;
  }

  destroy() {
    for (const timerId of this._excitationTimers.values()) {
      clearTimeout(timerId);
    }
    this._excitationTimers.clear();
    this._cancelMonologue();
    this._speakingStates.clear();
    this._conversationStates.clear();
    this._groups.clear();
    this._userGroupId.clear();
    this._heldUsers.clear();
  }

  broadcastState() {
    this._broadcastState();
  }

  _broadcastState() {
    const groups = [];
    for (const [groupId, group] of this._groups.entries()) {
      groups.push({
        id: groupId,
        color: group.color,
        members: Array.from(group.members),
      });
    }
    const states = {};
    for (const [uid, state] of this._conversationStates.entries()) {
      states[uid] = state;
    }
    const monologue = this._monologue ? {userId: this._monologue.userId} : null;
    const held = Array.from(this._heldUsers);
    this._broadcast({
      conversationState: {groups, states, monologue, held},
    });
  }
}

module.exports = ConversationGroupManager;
