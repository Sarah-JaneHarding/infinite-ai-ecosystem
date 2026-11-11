function(p,e,c){
 var s=p.summary; if(!s) return H.need('No import summary.',['summary']); var o=H.base(c); o.status='ok'; o.runId=c.idFor(e.runId); o.recordsReceived=s.rowsRead; o.recordsConformed=s.recordsMapped; o.recordsRejected=s.rowsLeftOut; return o;
}
