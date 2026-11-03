import test from 'node:test';
import assert from 'node:assert/strict';
import {accountSectionFrom} from './account-sections';

test('account settings open the section the address names', () => {
  assert.equal(accountSectionFrom(''), 'account');
  assert.equal(accountSectionFrom('?tab=profiles'), 'profiles');
  assert.equal(accountSectionFrom('?tab=Supporter'), 'supporter');
  assert.equal(accountSectionFrom('', '#profiles'), 'profiles');
  assert.equal(accountSectionFrom('?tab=privacy'), 'profiles');
  assert.equal(accountSectionFrom('?tab=nonsense'), 'account');
});
test('a claim link opens Supporter, where the claim form is', () => {
  assert.equal(accountSectionFrom('?claim'), 'supporter');
  assert.equal(accountSectionFrom('?claim=CLM-AAAA-BBBB-CCCC-DDDD'), 'supporter');
  assert.equal(accountSectionFrom('?claim=42'), 'supporter');
  assert.equal(accountSectionFrom('?claim=42&tab=supporter'), 'supporter');
});
test('RuneLite opens only where the plugin page is shown', () => {
  assert.equal(accountSectionFrom('?tab=runelite', '', true), 'runelite');
  assert.equal(accountSectionFrom('?tab=plugin', '', true), 'runelite');
  assert.equal(accountSectionFrom('?tab=runelite', '', false), 'account');
});
