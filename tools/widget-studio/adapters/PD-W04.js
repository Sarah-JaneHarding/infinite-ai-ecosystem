function(p,e,c){
 var cohort=p.peopleCovered||0, min=p.minGroup||5;
 if(p.suppressed||cohort<min) return {status:'suppressed',reason:'cohort_below_minimum',minimumRequired:min,actual:cohort,detail:'Fewer than '+min+' people are covered, so no profile is shown.'};
 var A=(p.profile&&p.profile.areas)||[]; if(!A.length) return H.need('No need areas in the profile.',['profile.areas']);
 var map={'pacing':'coverage','item quality':'assessment','observation themes':'walkthrough','qms development needs':'artefact_edit','cptd status':'artefact_edit'};
 var o=H.base(c); o.status='ok'; o.signalsAggregated=(p.signals||[]).length; o.cohortSize=cohort;
 o.needAreas=A.map(function(a){var n=(a.signals||[]).length+(a.signalTypes||[]).length;return {area:a.label,signalSources:H.uniq((a.signalTypes||[]).map(function(t){return map[t]||'coverage'})),urgency:n>=4?'high':n>=2?'medium':'low',evidenceSummary:(a.signals||[]).map(function(s){return s.summary}).join('; ')||'Evidence listed in the source references.'}});
 o.summary=A.length+' need area(s) from '+o.signalsAggregated+' signal(s) across '+cohort+' people. AI drafts; the PD coordinator decides.'; return o;
}
