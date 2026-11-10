function(p,e,c){
 var M=p.memo||[]; if(!M.length) return H.need('No memo lines.',['memo']);
 var miss=M.filter(function(m){return !m.check||m.check.secondAnswer==null}).map(function(m){return m.itemNo});
 if(miss.length) return H.need('The agent contract needs the verifier\'s own answer for every item. Items without one: '+miss.join(', ')+'.',['verifierAnswer for items '+miss.join(', ')]);
 var ver=M.map(function(m){return {itemId:c.idFor(e.runId+':item:'+m.itemNo),authorAnswer:String(m.answer),verifierAnswer:String(m.check.secondAnswer),agrees:m.check.status==='verified'}});
 var bad=ver.filter(function(v){return !v.agrees});
 if(bad.length) return {status:'disagreement_flagged',flaggedItems:bad,allItems:ver,detail:bad.length+' item(s) where the second answer does not match the author. A person decides.'};
 var o=H.artefact(p,c,e,'MARKING_MEMO'); o.status='verified';
 o.answerKey=M.map(function(m){var a={itemId:c.idFor(e.runId+':item:'+m.itemNo),modelAnswer:m.workedAnswer||String(m.answer),markingCriteria:(m.steps||[]).map(function(s){return s.earnedBy+' ('+s.marks+')'}).join('; ')||'See model answer'};var mm=/^([A-D])\)/.exec(String(m.answer));if(mm)a.correctOptionId=mm[1];return a});
 o.verificationItems=ver; o.totalMarks=p.totalMarks; return o;
}
