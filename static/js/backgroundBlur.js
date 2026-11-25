'use strict';

const {createGaussianBackground} = require('./gaussianBackground');

// The caller owns the camera until this succeeds, then close() releases it.
exports.createBackgroundBlur = async (camera, onEnded) => {
  const base = new URL('../ep_webrtc/blur/', document.baseURI);
  const {FilesetResolver, ImageSegmenter} = await import(new URL('vision_bundle.mjs', base).href);
  const files = await FilesetResolver.forVisionTasks(base.href.slice(0, -1));
  const segmenter = await ImageSegmenter.createFromOptions(files, {
    baseOptions: {
      delegate: 'GPU',
      modelAssetPath: new URL('selfie_segmenter_landscape.tflite', base).href,
    },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([camera]);
  const surface = () => document.createElement('canvas');
  const canvas = surface();
  const ctx = canvas.getContext('2d');
  const mask = surface();
  const maskCtx = mask.getContext('2d');
  let background;
  let pixels;
  let track;
  let nextFrame;
  const draw = ({confidenceMasks: [person]}) => {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    if (!pixels || mask.width !== person.width || mask.height !== person.height) {
      mask.width = person.width;
      mask.height = person.height;
      pixels = maskCtx.createImageData(mask.width, mask.height);
    }
    const confidence = person.getAsFloat32Array();
    for (let i = 0; i < confidence.length; ++i) pixels.data[4 * i + 3] = confidence[i] * 255;
    maskCtx.putImageData(pixels, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(video, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.drawImage(background.draw(video), 0, 0, canvas.width, canvas.height);
  };
  const frame = (now) => {
    try {
      if (track.enabled) segmenter.segmentForVideo(video, now, draw);
      nextFrame = video.requestVideoFrameCallback(frame);
    } catch (err) {
      onEnded(err);
    }
  };
  const ended = () => onEnded();
  const close = () => {
    camera.removeEventListener('ended', ended);
    if (nextFrame != null) video.cancelVideoFrameCallback(nextFrame);
    video.srcObject = null;
    background?.close();
    segmenter.close();
    track?.stop();
    camera.stop();
  };
  try {
    await video.play();
    if (camera.readyState === 'ended') throw new Error('Camera ended during blur setup');
    background = createGaussianBackground();
    segmenter.segmentForVideo(video, performance.now(), draw);
    [track] = canvas.captureStream().getVideoTracks();
    camera.addEventListener('ended', ended);
    nextFrame = video.requestVideoFrameCallback(frame);
    return {camera, track, close};
  } catch (err) {
    close();
    throw err;
  }
};
