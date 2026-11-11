function(p,e,c){
 var E=(p.entries||[]).filter(function(x){return x.mark==='counted'}); if(!E.length) return {status:'no_policy_match',detail:'No entry in the journal was counted against a schedule line.',activityType:((p.entries||[])[0]||{}).activityType||'none'};
 var l=E[E.length-1],d=H.dt(l.date)||c.now();
 var o={status:'ok',teacherRef:p.teacherCode,activityType:l.activityType,pointsAwarded:l.countedPoints,policyReference:l.scheduleSource,citedPolicyDocumentId:l.scheduleSource,loggedAt:d,cycleTotal:p.pointsCounted}; return o;
}
