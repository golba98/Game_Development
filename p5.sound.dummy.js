// Dummy p5.sound implementation to unblock game loading
console.warn("Using dummy p5.sound implementation. Sound will be disabled due to corrupted library.");
p5.prototype.loadSound = function(path, successCallback) {
  var dummySound = {
    play: function() {},
    stop: function() {},
    pause: function() {},
    loop: function() {},
    setVolume: function() {},
    isPlaying: function() { return false; },
    isLoaded: function() { return true; },
    duration: function() { return 0; },
    time: function() { return 0; },
    addCue: function() {},
    removeCue: function() {},
    clearCues: function() {},
    onended: function() {},
    connect: function() {},
    disconnect: function() {}
  };
  if (successCallback) {
      setTimeout(function() { successCallback(dummySound); }, 10);
  }
  return dummySound;
};
p5.prototype.userStartAudio = function() { return Promise.resolve(); };
p5.prototype.getAudioContext = function() { return { resume: function() {}, state: 'running' }; };
p5.prototype.soundOut = { input: { connect: function(){} } }; 
p5.prototype.fft = function() { 
    return { analyze: function(){ return []; }, getEnergy: function(){ return 0; } }; 
};
