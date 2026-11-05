import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RoadGuardAPI} from '../api.js';
test('URL rejects unsafe schemes and credentials',()=>{
 assert.throws(()=>new RoadGuardAPI('javascript:alert(1)'));
 assert.throws(()=>new RoadGuardAPI('http://user:pass@localhost'));
});
test('list constructs pagination and authentication',async()=>{
 globalThis.fetch=async(url,opts)=>{assert.equal(url,'http://localhost:8000/api/potholes?limit=20&offset=40&status=confirmed');assert.equal(opts.headers['X-API-Key'],'test');return new Response(JSON.stringify({total:1,items:[]}));};
 assert.equal((await new RoadGuardAPI('http://localhost:8000/','test').list('confirmed',20,40)).total,1);
});
test('report sends JSON with valid content type',async()=>{
 globalThis.fetch=async(url,opts)=>{assert.equal(opts.method,'POST');assert.equal(opts.headers['Content-Type'],'application/json');assert.equal(JSON.parse(opts.body).latitude,16.5);return new Response('{"id":"report1"}');};
 assert.equal((await new RoadGuardAPI().report({latitude:16.5,longitude:80.5})).id,'report1');
});
test('status change encodes IDs and preserves note',async()=>{
 globalThis.fetch=async(url,opts)=>{assert.ok(url.endsWith('/a%2Fb/status'));assert.equal(opts.method,'PATCH');assert.equal(JSON.parse(opts.body).note,'Verified repair');return new Response('{}');};
 await new RoadGuardAPI().status('a/b','resolved','Verified repair');
});
test('nearby encodes coordinates and radius',async()=>{
 globalThis.fetch=async(url)=>{assert.ok(url.endsWith('latitude=16.5&longitude=80.5&radius_m=100'));return new Response('{"items":[]}');};
 assert.deepEqual((await new RoadGuardAPI().nearby(16.5,80.5,100)).items,[]);
});
test('authorization error is actionable',async()=>{
 globalThis.fetch=async()=>new Response('{"detail":"Unauthorized"}',{status:401});
 await assert.rejects(new RoadGuardAPI().health(),/API key required/);
});
test('invalid JSON and network errors are actionable',async()=>{
 globalThis.fetch=async()=>new Response('<html>bad</html>');await assert.rejects(new RoadGuardAPI().health(),/non-JSON/);
 globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};await assert.rejects(new RoadGuardAPI().health(),/Cannot reach FastAPI/);
});
