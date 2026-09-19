#!/bin/bash

set -e

php artisan package:discover --ansi
php artisan config:cache

exec apache2-foreground