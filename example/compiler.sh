#!/bin/bash

gcc -o program $1
if [ $? == 0 ]; then
  ./program
  exit $?
fi
exit 0
