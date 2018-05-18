# Purpose

Uploads static assets to S3 when deploying to heroku.
Requires NodeJS to be installed when building.

# Setting Mandatory Environment Variables for build

```
AWS_ACCESS_KEY_ID=<aws access key id>
AWS_SECRET_ACCESS_KEY=<aws secret access key>
AWS_DEFAULT_REGION=<aws-region>
AWS_STATIC_BUCKET_NAME=<s3-bucket-name>
# prefix to include in path
AWS_STATIC_PREFIX=static
# The directory to upload to S3 (uploads the content of the directory)
AWS_STATIC_SOURCE_DIRECTORY=public
```

# Exported Environment Variables to runtime

```sh
STATIC_ASSETS_SERVER=<AWS_STATIC_BUCKET_NAME>.s3.amazonaws.com
STATIC_ASSETS_URL_PREFIX=$STATIC_ASSETS_SERVER/$AWS_STATIC_PREFIX
```

These variables can be overriden with config vars as expected

```
heroku config:set STATIC_ASSETS_SERVER=your.cdn.host
```

To return to the default value just unset the config vars

```
heroku config:unset STATIC_ASSETS_SERVER
```

