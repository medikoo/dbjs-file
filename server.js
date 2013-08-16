'use strict';

var callable  = require('es5-ext/lib/Object/valid-callable')
  , isId      = require('time-uuid/lib/is-id')
  , getObject = require('dbjs/lib/objects')._get
  , rename    = require('fs2/lib/rename')
  , resolve   = require('path').resolve

  , defNameResolve = function (db, file) { return db._id_ + '.' + file.name; };

module.exports = function (File, uploadPath/*, nameResolve*/) {
	var nameResolve = arguments[2];

	uploadPath = resolve(String(uploadPath));
	nameResolve = (nameResolve != null) ? callable(nameResolve) : defNameResolve;

	return function (data, res) {
		var path, dbFile;
		if (!isId(data.id) || !(data.file instanceof File)) {
			res.statusCode = 400;
			res.end("Invalid data");
			return;
		}

		dbFile = getObject(data.id);
		path = resolve(uploadPath, nameResolve(dbFile, data.file));
		rename(data.file.path, path)(function () {
			dbFile.dir = path;
			dbFile.size = data.file.size;
			if (dbFile.onUpload) return dbFile.onUpload();
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
