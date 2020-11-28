#!/bin/bash

.bin/build.sh

deno fmt --check *.ts

if [[ "$?" != "0" ]]
then
    exit -1
fi

deno test --allow-all
