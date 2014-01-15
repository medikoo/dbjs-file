'use strict';

var callable  = require('es5-ext/object/valid-callable')
  , isId      = require('time-uuid/lib/is-id')
  , rename    = require('fs2/lib/rename')
  , resolve   = require('path').resolve
  , validDb   = require('dbjs/valid-dbjs')

  , defNameResolve = function (db, file) { return db.__id__ + '.' + file.name; }
  , fireOnUpload;

fireOnUpload = function () {
	if (this.onUpload) this.onUpload();
};

module.exports = function (db, File, uploadPath/*, nameResolve*/) {
	var nameResolve = arguments[3], unserialize = validDb(db).objects.unserialize;

	uploadPath = resolve(String(uploadPath));
	nameResolve = (nameResolve != null) ? callable(nameResolve) : defNameResolve;

	return function (data, res) {
		var path, dbFile;
		if (!isId(data.id) || !(data.file instanceof File)) {
			if (!isId(data.id)) console.error("Upload error: Invalid id " + data.id);
			if (!(data.file instanceof File)) {
				console.error("Upload error: Unexpected file type");
			}
			res.statusCode = 400;
			res.end("Invalid data");
			return;
		}

		dbFile = unserialize(data.id);
		path = resolve(uploadPath, nameResolve(dbFile, data.file));
		rename(data.file.path, path)(function () {
			dbFile.path = path;
			dbFile.size = data.file.size;
			if (dbFile.Type === db.Object) dbFile.once('turn', fireOnUpload);
			else if (dbFile.onUpload) return dbFile.onUpload();
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
