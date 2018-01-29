(function () {
	'use strict';
	function randInt(max) {
  		return Math.floor(Math.random() * Math.floor(max));
	}

	function buildSheet() {

		var keyNumber = document.getElementById('keynumber').value;
		var maxSecondValue = document.getElementById('maxsecondvalue').value;
		var questionCount = 20;

		var main = document.getElementById("content");
		var bodyText = `<div class="parent"><div class="left">`;

		for (var i = 0; i < questionCount; i++) {
			if(i == questionCount/2) {
				bodyText = bodyText + `</div><div class="right">`;
			}
			var secondVal = randInt(maxSecondValue);
			var firstVal = keyNumber;
			var operator = "+";
			// add or subtract
			if(Math.floor(Math.random() * 2) == 0) {
				operator = "-";
				// want the answer to be positive
				if(secondVal > firstVal) {
					firstVal = secondVal;
					secondVal = keyNumber;
				}
			}
			var newRow =  `<p class="equation">${firstVal} ${operator} ${secondVal} = ________</p>`;
			if(bodyText.includes(newRow)) {
				// generate a new random row, we already got this one
				i--;
			} else {
				bodyText = bodyText + newRow;
			}
		}
		bodyText = bodyText + `</div></div>`;
		main.innerHTML = bodyText;
	}

	buildSheet();

	document.getElementById("keynumber").addEventListener('change', buildSheet);
	document.getElementById("maxsecondvalue").addEventListener('change', buildSheet);

})();

