FROM etherpad/etherpad:3
USER root
COPY --chown=etherpad:etherpad package.json index.js conversationGroupManager.js ep.json /tmp/ep_webrtc/
COPY --chown=etherpad:etherpad static /tmp/ep_webrtc/static
COPY --chown=etherpad:etherpad templates /tmp/ep_webrtc/templates
COPY --chown=etherpad:etherpad locales /tmp/ep_webrtc/locales
USER etherpad
RUN pnpm run plugins i --path /tmp/ep_webrtc
