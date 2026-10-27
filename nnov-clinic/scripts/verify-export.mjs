import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
assert.deepEqual(readFileSync('index.html'), readFileSync('dist/index.html'));
console.log('Export verified: root index.html matches dist/index.html.');
