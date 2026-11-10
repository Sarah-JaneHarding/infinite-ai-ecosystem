function(p,e,c){
 var T=p.tasks||[]; if(!T.length) return H.need('No tasks.',['tasks']); var src=H.cited(p); if(!src.length) return H.noSrc(); var pr=p.prerequisite; if(!pr) return H.need('No prerequisite skill.',['prerequisite']);
 var r=H.readab(c); if(r.need) return H.needRead(r); if(r.out) return H.need('Measured reading grade is outside the target band.',['measuredGrade']);
 var o=H.artefact(p,c,e,'REMEDIATION_PACK'); o.sections=[{skillId:pr.capsTopicId,skillDescription:pr.skill,explanation:'Practise the skill '+pr.skill+' in steps: '+H.uniq(T.map(function(t){return t.stage})).join(', ')+'.',workedExamples:T.map(function(t){return t.task+' Answer: '+t.answer}),practiceItems:T.map(function(t){return t.task})}];
 o.readabilityCheckResult=r.ok; o.citedSourceIds=src; return o;
}
