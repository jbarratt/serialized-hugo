(function () {
	'use strict';

	function randInt(max) {
			// random integer in range, tries to prefer smaller numbers
			// So 50% of the time, divide by 2.
			var result = Math.floor(Math.random() * Math.floor(max));
			if(Math.floor(Math.random() * 2) == 0) {
				result = Math.floor(result * 0.5);
			}
			return result;
	}


	function buildSheet() {

		var keyNumber = document.getElementById('keynumber').value;
		var maxSecondValue = document.getElementById('maxsecondvalue').value;
		var questionCount = 20;

		var main = document.getElementById("content");
		var bodyText = `<div class="parent"><div class="left">`;

		// allow picking random items from arrays
		Array.prototype.random = function () {
  		return this[Math.floor((Math.random()*this.length))];
		}

		function secondValue() {
			return randInt(maxSecondValue);
		}

		function additionProblem() {
			if(Math.floor(Math.random() * 2) == 0) {
				// swap the order for fun, e.g. (7+5) or (5+7)
				return {
					"first": keyNumber,
					"second": secondValue(),
					"op": "+"}
			} else {
				return {
					"first": secondValue(),
					"second": keyNumber,
					"op": "+"}
			}
		}

		function subtractionProblem() {
			var secondVal = secondValue();
			var firstVal = keyNumber;
			if(secondVal > firstVal) {
					firstVal = secondVal;
					secondVal = keyNumber;
			}
			return {
				"first": firstVal,
				"second": secondVal,
				"op": "-"
			}
		}

		function multiplicationProblem() {
			if(Math.floor(Math.random() * 2) == 0) {
				// swap the order for fun, e.g. (7X5) or (5X7)
				return {
					"first": keyNumber,
					"second": secondValue(),
					"op": "X"}
			} else {
				return {
					"first": secondValue(),
					"second": keyNumber,
					"op": "×"
				}
			}
		}

		function divisionProblem() {
			return {
				"first": secondValue() * keyNumber,
				"second": keyNumber,
				"op": "÷"
			}
		}

		var generators = [];
		// DRY VIOLATIONS ALL OVER THE PLACE
		if(document.getElementById("addition").checked) {
			generators.push(additionProblem)
		}
		if(document.getElementById("multiplication").checked) {
			generators.push(multiplicationProblem)
		}
		if(document.getElementById("subtraction").checked) {
			generators.push(subtractionProblem)
		}
		if(document.getElementById("division").checked) {
			generators.push(divisionProblem)
		}

		for (var i = 0; i < questionCount; i++) {
			if(i == questionCount/2) {
				bodyText = bodyText + `</div><div class="right">`;
			}

			// run one of the random generator functions
			var problem = generators.random()();

			var newRow =  `<p class="equation">${problem.first} ${problem.op} ${problem.second} = </p>`;

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
	document.getElementById("addition").addEventListener('change', buildSheet);
	document.getElementById("subtraction").addEventListener('change', buildSheet);
	document.getElementById("multiplication").addEventListener('change', buildSheet);
	document.getElementById("division").addEventListener('change', buildSheet);

})();
