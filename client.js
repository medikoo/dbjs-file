'use strict';

var isError = require('es5-ext/error/is-error')
  , file    = require('dbjs/lib/objects')._get('File').prototype;

module.exports = function (FormData, XMLHttpRequest, File, url) {
	file._$construct.$$setValue(function (file) {
		var fd, xhr, onError;

		fd = new FormData();
		xhr = new XMLHttpRequest();
		fd.append('file', file);
		fd.append('id', this._id_);

		onError = function (e) {
			this.emit('error', e);
			this.delete();
		}.bind(this);

		xhr.open('POST', url, true);
		xhr.onload = function (data) {
			if (isError(data)) {
				onError(data);
			} else if ((xhr.status < 200) || (xhr.status >= 300)) {
				onError(new Error(xhr.responseText));
			}
		};
		xhr.onerror = function () { onError(new Error("Error occured")); };
		xhr.onabort = function () { onError(new Error("Operation aborted")); };
		xhr.upload.onabort = xhr.onabort;
		xhr.upload.onprogress = this.emit.bind(this, 'upload-progress');
		xhr.send(fd);

		this.name = file.name;
		this.type = file.type;
	});
	file._validateConstruction.$$setValue(function (file) {
		if (file.constructor !== File) {
			return new TypeError(file + " is not a File instance");
		}
		return this.validateCreateProperties({
			type: file.type,
			name: file.name
		});
	});
};
