function(p,e,c){
 var I=p.items||[]; if(!I.length) return H.need('No items.',['items']); var src=H.cited(p); if(!src.length) return H.noSrc();
 var T={'multiple choice':'multiple_choice','short answer':'short_answer','extended response':'extended_response','true/false':'true_false','true or false':'true_false'},L={knowledge:'knowledge',comprehension:'comprehension',application:'application',analysis:'analysis',synthesis:'synthesis',evaluation:'evaluation'};
 var badT=H.uniq(I.filter(function(i){return !T[String(i.type).toLowerCase()]}).map(function(i){return i.type})), badL=H.uniq(I.filter(function(i){return !L[String(i.level).toLowerCase()]}).map(function(i){return i.level}));
 if(badT.length||badL.length) return H.need('The agent contract uses fixed item types and cognitive levels. Not matched: '+(badT.length?'item type '+badT.join(', ')+'. ':'')+(badL.length?'level '+badL.join(', ')+' (the CAPS level names are not the agent\'s list; the mapping is a policy decision, so none is guessed).':''),['itemType / cognitiveLevel mapping']);
 var r=H.readab(c); if(r.need) return H.needRead(r); if(r.out) return H.need('Measured reading grade is outside the target band.',['measuredGrade']);
 var o=H.artefact(p,c,e,'ASSESSMENT_ITEM');
 o.items=I.map(function(i){return {itemId:c.idFor(e.runId+':item:'+i.itemNo),questionText:i.question,itemType:T[String(i.type).toLowerCase()],cognitiveLevel:L[String(i.level).toLowerCase()],options:Object.keys(i.options||{}).map(function(k){return {optionId:k,text:String(i.options[k])}}),marks:i.marks}});
 o.totalMarks=p.totalMarks; o.readabilityCheckResult=r.ok; o.citedSourceIds=src; return o;
}
