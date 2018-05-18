var AWS = require('aws-sdk');
var glob = require('glob');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var mimeTypes = require('mime-types');
var shelljs = require('shelljs');

function getEnvVariable(name) {
  return process.env[name] || fs.readFileSync(path.join(process.env.ENV_DIR, name), {encoding: 'utf8'});
}

try {

  // AWS.config.logger = process.stdout;
  AWS.config.maxRetries = 10;

  AWS.config.accessKeyId = getEnvVariable('AWS_ACCESS_KEY_ID');
  AWS.config.secretAccessKey = getEnvVariable('AWS_SECRET_ACCESS_KEY');
  AWS.config.region = getEnvVariable('AWS_DEFAULT_REGION');

  // bucket where static assets are uploaded to
  var AWS_STATIC_BUCKET_NAME = getEnvVariable('AWS_STATIC_BUCKET_NAME');
  // the source directory of static assets
  var AWS_STATIC_SOURCE_DIRECTORY = getEnvVariable('AWS_STATIC_SOURCE_DIRECTORY');
  // the prefix assigned to the path, often the app name or deployed environment
  var AWS_STATIC_PREFIX = getEnvVariable('AWS_STATIC_PREFIX');

} catch(error) {
  console.error('Static Uploader is not configured for this deploy');
  console.error(error);
  console.error('Exiting without error');
  process.exit(0);
}

// the sha-1 or version supplied by heroku used to version builds in the path
var BUILD_DIR = process.env.BUILD_DIR;

// location of public assets in the heroku build environment
var PUBLIC_ASSETS_SOURCE_DIRECTORY = path.join(BUILD_DIR, AWS_STATIC_SOURCE_DIRECTORY);

glob(PUBLIC_ASSETS_SOURCE_DIRECTORY + '/**/*.*', {}, function(error, files) {

    if (error || !files) {
      return process.exit(1);
    }

    console.log('Files to Upload:', files.length);
    console.time('Upload Complete In');

    var yearInMs = 365 * 24 * 60 * 60000;
    var yearFromNow = Date.now() + yearInMs;
    var bucket = AWS_STATIC_BUCKET_NAME;

    var s3 = new AWS.S3();
    async.eachLimit(files, 16, function(file, callback) {

        var stat = fs.statSync(file);
        if (!stat.isFile()) {
          console.log('Not a file', file);
          return callback(null);
        }

        var contentType = mimeTypes.lookup(path.extname(file)) || null;
        if (!_.isString(contentType)) {
          console.warn('Unknown ContentType:', contentType, file);
          contentType = 'application/octet-stream';
        }

        var isNew = true;
        var key = path.join(AWS_STATIC_PREFIX, file.replace(PUBLIC_ASSETS_SOURCE_DIRECTORY, ''));

        s3.headObject({Key: key, Bucket: bucket}, function(err, data) {
            if(err) {
                isNew = true
            } else {
                isNew = (data["ContentLength"] != stat.size);
            }
        });

        if (isNew) {
            console.log("Uploading file:", file);
            s3.upload({
                ACL: 'public-read',
                Key: key,
                Body: fs.createReadStream(file),
                Bucket: bucket,
                Expires: new Date(yearFromNow),
                CacheControl: 'public,max-age=' + yearInMs + ',smax-age=' + yearInMs,
                ContentType: contentType
            }, callback);
        } else {
            console.log("Skipping file (already exists):", file);
        }
      },
      function onUploadComplete(error) {
        console.timeEnd('Upload Complete In');

        if (error) {
          console.error('Static Uploader failed to upload to S3');
          console.error(error);
          console.error('Exiting without error');
          process.exit(0);
        }

        var profiled = process.env.BUILD_DIR + '/.profile.d';
        fs.writeFileSync(
          path.join(profiled, '00-upload-static-files-to-s3-export-env.sh'),
          'echo EXPORTING STATIC ENV VARIABLES\n' +
          'export STATIC_ASSETS_SERVER=${STATIC_ASSETS_SERVER:-' + AWS_STATIC_BUCKET_NAME + '.s3.amazonaws.com' + '}\n' +
          'export STATIC_ASSETS_URL_PREFIX="${STATIC_ASSETS_SERVER}/${AWS_STATIC_PREFIX}"\n'
          {encoding: 'utf8'}
        );

        process.exit(0);
      });
  }
);
