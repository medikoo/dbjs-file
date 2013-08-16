'use strict';

var isError  = require('es5-ext/lib/Error/is-error')
  , deferred = require('deferred')
  , file     = require('dbjs/lib/objects')._get('File').prototype;

module.exports = function (FormData, XMLHttpRequest, File, url) {
	file._$construct.$$setValue(function (file) {
		var fd, xhr, def = deferred();

		fd = new FormData();
		xhr = new XMLHttpRequest();
		fd.append('file', file);
		fd.append('id', this._id_);

		xhr.open('POST', url, true);
		xhr.onload = function (data) {
			if (isError(data)) {
				def.reject(data);
			} else if ((xhr.status < 200) || (xhr.status >= 300)) {
				def.reject(new Error(xhr.responseText));
			} else {
				def.resolve(data && data.currentTarget);
			}
		};
		xhr.onerror = function () { def.reject(new Error("Error occured")); };
		xhr.onabort = function () { def.reject(new Error("Operation aborted")); };
		xhr.upload.onabort = xhr.onabort;
		xhr.upload.onprogress = function (e) {
			def.promise.emit('progress', e);
		};
		xhr.send(fd);
		def.promise.xhr = xhr;
		def.promise.done(null, function (err) {
			this.delete();
			throw err;
		}.bind(this));

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
