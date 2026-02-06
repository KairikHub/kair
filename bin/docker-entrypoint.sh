#!/usr/bin/env sh
set -e

if [ "$#" -eq 0 ]; then
  exec npm run kairik --
fi

case "$1" in
  kairik)
    shift
    exec npm run kairik -- "$@"
    ;;
  contract|propose|create|plan|require-controls|add-control|approve-control|request-approval|approve|run|execute|pause|resume|rewind|status|list|--help|-h)
    exec npm run kairik -- "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
