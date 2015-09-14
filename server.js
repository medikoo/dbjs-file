'use strict';

var customError = require('es5-ext/error/custom')
  , callable    = require('es5-ext/object/valid-callable')
  , normalize   = require('es5-ext/string/#/normalize')
  , replace     = require('es5-ext/string/#/plain-replace-all')
  , d           = require('d')
  , rename      = require('fs2/rename')
  , resolve     = require('path').resolve
  , validDb     = require('dbjs/valid-dbjs')
  , typeMap     = require('./lib/type-map')

  , defineProperties = Object.defineProperties, defineProperty = Object.defineProperty
  , nextTick = process.nextTick;

var defNameResolve = function (dbFile, file) {
	return replace.call(dbFile.__id__, '/', '-') + '.' +
		normalize.call(dbFile.database.Filename.adapt(file.name));
};

var handleError = function (err) {
	if (err.code !== 'UNSUPPORTED_FILE_TYPE') throw err;
	console.error(err.message);
};

var invokeOnUpload = function () {
	var result = this.onUpload();
	if (result && (typeof result.done === 'function')) result.done(null, handleError);
};

var scheduleOnUpload = function () {
	if (this.onUpload) nextTick(invokeOnUpload.bind(this));
};

module.exports = function (db, uploadPath/*, nameResolve*/) {
	var nameResolve = arguments[2], unserialize = validDb(db).objects.unserialize
	  , validateCreate = db.File._validateCreate_;

	uploadPath = resolve(String(uploadPath));
	nameResolve = (nameResolve != null) ? callable(nameResolve) : defNameResolve;

	defineProperties(db.File, {
		uploadsInProgress: d([]),
		_validateCreate_: d(function (file) {
			if (!file) return [file];
			if (file.ws && file.headers && file.path && file.name) {
				validateCreate.call(this);
				if (!file.name) this.prototype._validateSet_('name', file.name);
				if (!db.File.accept.has(file.type)) {
					throw customError("Unsupported file type", 'UNSUPPORTED_FILE_TYPE');
				}
				return [file];
			}
			throw new TypeError(file + " does not come from multiparty");
		})
	});

	defineProperty(db.File.prototype, '_initialize_', d(function (file) {
		var filename, path;

		if (!file) return;
		this.name = normalize.call(db.Filename.adapt(file.name));
		this.type = typeMap[file.type] || file.type;

		filename = nameResolve(this, file);
		path = resolve(uploadPath, filename);
		db.File.uploadsInProgress.push(rename(file.path, path)(function () {
			this.path = filename;
			this.diskSize = file.size;
			return this.onUpload();
		}.bind(this)));
	}));

	return function (data, res) {
		var path, dbFile, filename;
		if (!data.id || !data.file) {
			if (!data.id) console.error("Upload error: No id");
			if (!data.file) console.error("Upload error: Missing file");
			res.statusCode = 400;
			res.end("Invalid data");
			return;
		}

		dbFile = unserialize(data.id);
		if (dbFile._kind_ === 'descriptor') dbFile = dbFile.object._get_(dbFile._sKey_);
		filename = nameResolve(dbFile, data.file);
		path = resolve(uploadPath, filename);
		rename(data.file.path, path)(function () {
			dbFile.path = filename;
			if ((dbFile.name !== data.file.name) || (normalize.call(dbFile.name) !== dbFile.name)) {
				dbFile.name = normalize.call(db.Filename.adapt(data.file.name));
			}
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
