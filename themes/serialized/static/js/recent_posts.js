// From https://mathiasbynens.be/notes/xhr-responsetype-json
// Lighter weight than a fetch polyfill for safari
var getJSON = function(url, successHandler, errorHandler) {
	var xhr = new XMLHttpRequest();
	xhr.open('get', url, true);
	xhr.responseType = 'json';
	xhr.onload = function() {
		var status = xhr.status;
		if (status == 200) {
			successHandler && successHandler(xhr.response);
		} else {
			errorHandler && errorHandler(status);
		}
	};
	xhr.send();
};

function formatDate(datePublished) {
	d = new Date(datePublished);
	var lang = lang || 'en-US';
	result = d.toLocaleString(lang, { year: 'numeric', month: 'long', day: 'numeric' })
	if(result === "Invalid Date") {
		return datePublished;
	}
	return result;
}

getJSON('/index.json', function(recent) {
	var content = `
	<h3>Other Recent Posts</h3>
	<ul id="post-list" class="archive readmore">
	`
	for(var post=0; post < 5; post++) {
		var p = recent['items'][post];
		var date = formatDate(p.date_published);
		content += `
		<div class="post-item">
			<a href="${p.url}" class="post-link">
				${p.title}
			</a>
			<span class="post-time">${date}</span>
		</div>
		`
	}
	content += "</ul>"
	var footer = document.getElementById('footer');
	footer.insertAdjacentHTML('beforebegin', content);
}, function(status) {
	console.log('Unable to load recent posts JSON.');
});
