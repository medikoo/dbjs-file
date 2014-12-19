'use strict';

var callable  = require('es5-ext/object/valid-callable')
  , replace   = require('es5-ext/string/#/plain-replace-all')
  , rename    = require('fs2/rename')
  , resolve   = require('path').resolve
  , validDb   = require('dbjs/valid-dbjs')

  , nextTick = process.nextTick;

var defNameResolve = function (dbFile, file) {
	return replace.call(dbFile.__id__, '/', '-') + '.' + file.name;
};

var invokeOnUpload = function () {
	var result = this.onUpload();
	if (result.done) result.done();
};

var scheduleOnUpload = function () {
	if (this.onUpload) nextTick(invokeOnUpload.bind(this));
};

module.exports = function (db, uploadPath/*, nameResolve*/) {
	var nameResolve = arguments[3], unserialize = validDb(db).objects.unserialize;

	uploadPath = resolve(String(uploadPath));
	nameResolve = (nameResolve != null) ? callable(nameResolve) : defNameResolve;

	return function (data, res) {
		var path, dbFile;
		if (!data.id || !data.file) {
			if (!data.id) console.error("Upload error: No id");
			if (!data.file) console.error("Upload error: Missing file");
			res.statusCode = 400;
			res.end("Invalid data");
			return;
		}

		dbFile = unserialize(data.id);
		if (dbFile._kind_ === 'descriptor') {
			dbFile = dbFile.object._get_(dbFile._sKey_);
		}
		path = resolve(uploadPath, nameResolve(dbFile, data.file));
		rename(data.file.path, path)(function () {
			dbFile.path = path;
			if (dbFile.name !== data.file.name) dbFile.name = data.file.name;
			if (dbFile.type !== data.file.type) dbFile.type = data.file.type;
			dbFile.diskSize = data.file.size;
			if (dbFile.constructor === db.Object) dbFile.once('turn', scheduleOnUpload.bind(dbFile));
			else scheduleOnUpload.call(dbFile);
		}).done(function () {
			res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
			res.end('OK');
		}, function (e) {
			res.statusCode = 500;
			res.end("Server error");
			console.error(e.stack);
		});
	};
};
