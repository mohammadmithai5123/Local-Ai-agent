import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'csv-parse/sync';
import {filterLeads,groupConversation,leadsCsv,nearBottom,resultStatus} from '../src/ui-helpers.js';

test('discovery presentation keeps exhausted sources partial and quota pauses distinct from success',()=>{
 const set={origin:'public-tavily',rows:Array(5),requested:10,state:'partial'};
 assert.equal(resultStatus(set,{state:'completed'}),'partial');
 assert.equal(resultStatus(set,{state:'paused'}),'paused');
 assert.equal(resultStatus(set,{state:'running'}),'working');
 assert.equal(resultStatus(set,{state:'failed'}),'failed');
 assert.equal(resultStatus(set,{state:'cancelled'}),'cancelled');
 assert.equal(resultStatus({...set,rows:Array(10),state:'completed'},{state:'completed'}),'completed');
});
test('new chat activity follows only near the bottom, preserving older-message inspection',()=>{
 assert.equal(nearBottom(100,500,1800),false);
 assert.equal(nearBottom(1250,500,1800),true);
 assert.equal(nearBottom(0,500,200),true);
});
test('conversation grouping binds inline results to durable request IDs without dropping old history',()=>{
 const messages=[{id:'old',role:'assistant'},{id:'first-request',role:'user'},{id:'reply',role:'assistant'},{id:'second-request',role:'user'}];
 const groups=groupConversation(messages);
 assert.deepEqual(groups.map(g=>g.id),['older-history','first-request','second-request']);
 assert.deepEqual(groups.flatMap(g=>g.messages),messages);
});
test('lead search/country export includes only filtered rows, preserves CSV syntax and neutralizes formulas',()=>{
 const leads=[{name:'=HYPERLINK("bad")',company:'Hardware, "Tools"',email:'sample@example.com',city:'Dubai',country:'UAE',industry:'hardware'},{name:'Other',company:'Clothing',email:'other@example.com',city:'Lahore',country:'Pakistan',industry:'clothing'}];
 const filtered=filterLeads(leads,'HARDWARE','UAE');assert.equal(filtered.length,1);
 const rows:any[]=parse(leadsCsv(filtered),{bom:true,columns:true});assert.equal(rows.length,1);assert.equal(rows[0].Name,'\'=HYPERLINK("bad")');assert.equal(rows[0].Company,'Hardware, "Tools"');
 assert.equal(filterLeads(leads,'sample@example.com','').length,1);assert.equal(filterLeads(leads,'','Pakistan').length,1);assert.equal(filterLeads(leads,'missing','').length,0);
});
