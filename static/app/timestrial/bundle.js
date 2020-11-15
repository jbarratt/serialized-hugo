/**
 * Times Trial
 * practice, test button
 * question, answer fields
 */
function App() {

  var _this = this;
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  _this.score = 0;
  _this.targetScore = 0;
  _this.totalTime = 0;
  _this.elapsedTime = 0;
  _this.correctAnswer = 0;
  _this.showCorrect = false;
  _this.isRunning = false;

  _this.init = () => {

    _this.qElem = document.querySelector('#question');
    _this.aElem = document.querySelector('#answer');
    _this.scoreElem = document.querySelector('#score');
    _this.timeElem = document.querySelector('#time');
    _this.statusElem = document.querySelector('#status');
    _this.timeBarElem = document.querySelector('#timebar');
    _this.aElem.addEventListener('keyup', _this.submitAnswer);
    document.querySelector('#practice').onclick = _this.runPractice;
    document.querySelector('#test').onclick = _this.runTest;
  };

  _this.runPractice = () => { _this.startRound(60, 20, true); };
  _this.runTest = () => { _this.startRound(300, 100, false); };

  _this.tick = () => {
    _this.elapsedTime = _this.elapsedTime + 1;
    _this.render();
    if (_this.elapsedTime < _this.totalTime) {
      setTimeout(_this.tick, 1000);
    } else {
      _this.isRunning = false;
      _this.statusElem.innerHTML = `Game Over! Final Score: ${_this.score}`;
    }
  };

  _this.render = () => {
    _this.scoreElem.innerHTML = `Score: ${_this.score}`;
    var pct = Math.ceil(_this.elapsedTime * 100 / _this.totalTime);
    _this.timeBarElem.className = `bar w-${pct}`;
    _this.timeBarElem.innerHTML = `${_this.totalTime - _this.elapsedTime}s`;
  };

  _this.generateQuestion = () => {
    var a = randInt(2,12);
    var b = randInt(2,12);
    _this.correctAnswer = a * b;
    _this.qElem.innerHTML = `${a} X ${b} =`;
    _this.aElem.value = "";
    _this.aElem.focus();
  };

  _this.submitAnswer = (evt) => {
    if (evt.which != 13) {
      // only do this when they hit enter
      return
    }
    if (!_this.isRunning) {
      // don't accept answers when not running
      return
    }
    if (parseInt(_this.aElem.value) == _this.correctAnswer) {
      _this.score += 1;
      _this.generateQuestion();
      _this.statusElem.innerHTML = "Correct!";
    } else {
      _this.score -= 1;
      _this.aElem.value = "";
      _this.aElem.focus();
      if(_this.showCorrect) {
        _this.statusElem.innerHTML = `Incorrect. ${_this.qElem.innerHTML} ${_this.correctAnswer}`;
        _this.generateQuestion();
      } else {
        _this.statusElem.innerHTML = "Incorrect.";
      }
    }
    _this.render();
  };

  _this.startRound = (time, targetScore, showCorrect) => {
    _this.totalTime = time;
    _this.targetScore = targetScore;
    _this.showCorrect = showCorrect;
    _this.score = 0;
    _this.elapsedTime = 0;
    _this.isRunning = true;
    _this.generateQuestion();
    _this.render();
    setTimeout(_this.tick, 1000);
  };
}

var app = new App();

// Run the init message once the onload event fires
window.addEventListener("load", function () { app.init(); }, false);
//# sourceMappingURL=bundle.js.map
