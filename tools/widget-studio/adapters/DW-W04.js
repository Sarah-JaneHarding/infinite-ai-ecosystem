function(p,e,c){
 var C=p.completeness||[], s=p.summary; if(!C.length||!s) return H.need('No completeness figures.',['completeness']);
 var bd=c.extra.blockedDownstream; if(bd!=='true'&&bd!=='false') return H.need('The agent contract asks whether bad data blocks later steps (true or false). That is a school decision. Type true or false.',['blockedDownstream']);
 var ERR={required:1,duplicate:1,no_future:1,order:1};
 var o=H.base(c); o.status='ok'; o.qualityScore=H.r2(H.mean(C.map(function(x){return x.percent}))); o.blockedDownstream=bd==='true'; o.totalRecords=s.records; o.rejectedRecords=s.importRowsLeftOut;
 o.issues=(p.findings||[]).filter(function(f){return f.count>0}).map(function(f){var i={kind:f.rule,detail:f.count+' of '+f.of+' record(s) fail: '+f.ruleText,severity:ERR[f.rule]?'ERROR':'WARNING'};if(f.field)i.field=f.field;return i}); return o;
}
