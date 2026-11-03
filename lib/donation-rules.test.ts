import test from 'node:test';
import assert from 'node:assert/strict';
import {anonymousLabel,canReassign,claimCodeHash,claimCodeMatches,constantTimeEqual,newClaimCode,normalizeClaimCode,profileTotal,showsSupporter,validAmount,validCurrency,validSupportName} from './donation-rules.ts';

test('anonymous donations read as a zero-padded public number',()=>{
 assert.equal(anonymousLabel(42),'Anonymous #0042');
 assert.equal(anonymousLabel(12345),'Anonymous #12345');
});

test('claim codes are 80 random bits in a readable shape, and normalise like plugin tokens',()=>{
 const code=newClaimCode();
 assert.match(code,/^CLM(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
 assert.notEqual(newClaimCode(),code);
 assert.equal(normalizeClaimCode(code.toLowerCase().replaceAll('-',' ')),normalizeClaimCode(code));
 assert.equal(normalizeClaimCode('CLM-0000-0000-0000'),null);
 assert.equal(normalizeClaimCode('CLM-IIII-0000-0000-0000'),null,'I is not in the alphabet');
 assert.equal(normalizeClaimCode(42),null);
});

test('only the hash is kept, and a claim matches only the right code for an unclaimed donation',async()=>{
 const code=newClaimCode(),stored=(await claimCodeHash(code))!;
 assert.match(stored,/^[0-9a-f]{64}$/);
 assert.ok(!stored.includes(normalizeClaimCode(code)!));
 assert.equal(await claimCodeMatches(code,stored),true);
 assert.equal(await claimCodeMatches(code.toLowerCase(),stored),true);
 assert.equal(await claimCodeMatches(newClaimCode(),stored),false);
 assert.equal(await claimCodeMatches('not a code',stored),false);
 // Claiming clears the hash, so the same code cannot claim twice.
 assert.equal(await claimCodeMatches(code,null),false);
 // The public number alone is never enough.
 assert.equal(await claimCodeMatches('42',stored),false);
});

test('constant-time comparison agrees with ===, including different lengths',()=>{
 assert.equal(constantTimeEqual('abc','abc'),true);
 assert.equal(constantTimeEqual('abc','abd'),false);
 assert.equal(constantTimeEqual('abc','abcd'),false);
 assert.equal(constantTimeEqual('','x'),false);
 assert.equal(constantTimeEqual('',''),true);
});

test('amounts are positive whole minor units up to 100,000; currencies are three capitals',()=>{
 assert.equal(validAmount(1000),1000);
 for(const v of [0,-1,1.5,'1000',10_000_001,Number.NaN,null])assert.equal(validAmount(v),null);
 assert.equal(validCurrency('USD'),'USD');
 for(const v of ['usd','US','USDT',null])assert.equal(validCurrency(v),null);
});

test('a profile total counts completed donations only; refunds and chargebacks drop out',()=>{
 assert.deepEqual(profileTotal([]),{amountMinor:0,currency:null,granted:false});
 assert.deepEqual(profileTotal([
  {amountMinor:1000,currency:'USD',kind:'payment',status:'completed'},
  {amountMinor:2500,currency:'USD',kind:'payment',status:'completed'},
  {amountMinor:9000,currency:'USD',kind:'payment',status:'refunded'},
  {amountMinor:500,currency:'USD',kind:'payment',status:'reversed'},
 ]),{amountMinor:3500,currency:'USD',granted:false});
 assert.deepEqual(profileTotal([{amountMinor:0,currency:'USD',kind:'grant',status:'completed'}]),{amountMinor:0,currency:'USD',granted:true});
 // Old data in two currencies keeps the larger one, as the migration does.
 assert.deepEqual(profileTotal([{amountMinor:500,currency:'EUR',kind:'payment',status:'completed'},{amountMinor:900,currency:'USD',kind:'payment',status:'completed'}]).currency,'USD');
});

test('supporter status shows for a donation or grant, unless the recipient hides it',()=>{
 assert.equal(showsSupporter(null,true),false);
 assert.equal(showsSupporter({amountMinor:0,granted:false},true),false,'a fully refunded profile is not a supporter');
 assert.equal(showsSupporter({amountMinor:100,granted:false},true),true);
 assert.equal(showsSupporter({amountMinor:0,granted:true},true),true);
 assert.equal(showsSupporter({amountMinor:100,granted:false},false),false,'a gift the recipient hid');
});

test('a donor moves only their own donation, only between their own names, never a gift to someone else',()=>{
 const own=['Spoon Main','Spoon Alt'];
 const mine={donorId:'me',targetRsn:'spoon main',status:'completed'};
 assert.equal(canReassign(mine,'me',own,'spoon alt'),true);
 assert.equal(canReassign(mine,'me',own,null),true,'to no profile');
 assert.equal(canReassign(mine,'me',own,'someone else'),false);
 assert.equal(canReassign(mine,'you',own,'spoon alt'),false,'not the donor');
 assert.equal(canReassign({...mine,targetRsn:'gift target'},'me',own,'spoon alt'),false,'a gift stays with its recipient');
 assert.equal(canReassign({...mine,targetRsn:null},'me',own,'spoon alt'),true,'a donation to nobody can be given a profile');
 assert.equal(canReassign({...mine,donorId:null},'me',own,'spoon alt'),false,'an unclaimed anonymous donation belongs to nobody yet');
 assert.equal(canReassign({...mine,status:'refunded'},'me',own,'spoon alt'),false);
});
test('a donation can support any valid RuneScape name',()=>{
 for(const v of ['Zezima',' Lynx Titan ','a','iron_man-1','B0aty'])assert.equal(validSupportName(v),v.trim());
 for(const v of ['','   ','thirteen char','bad<name>','__','- -',12,null,undefined])assert.equal(validSupportName(v),null);
});
