"""TEST ONLY: minimal Supabase HTTP adapter; fake auth, real local PostgreSQL RLS.
No external connections. The adapter is deliberately not a production PostgREST replacement.
"""
import json, re, subprocess, sys
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
from pathlib import Path
root=Path(sys.argv[1]).resolve()
assert str(root).startswith('/tmp/instructor-qa.') and (root/'data/PG_VERSION').exists()
accounts={'supervisor@example.invalid':'02','instructor-a@example.invalid':'07','instructor-b@example.invalid':'08','unlinked@example.invalid':'09'}
def uid(n):return '00000000-0000-0000-0000-0000000000'+n
def quote(v):return "'"+str(v).replace("'","''")+"'"
def ident(v):
 if not re.fullmatch('[a-z_]+',v):raise ValueError('Invalid identifier')
 return '"'+v+'"'
def db(sql,user=None):
 pre="begin;"
 if user:pre+="set local role authenticated;set local request.jwt.claims="+quote(json.dumps({'sub':user,'role':'authenticated'}))+";"
 run=subprocess.run(['psql','-X','-h',str(root),'-p','55440','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt','-c',pre+sql+';commit;'],text=True,capture_output=True)
 if run.returncode:raise ValueError(run.stderr.strip())
 lines=run.stdout.strip().splitlines();return json.loads(lines[-1]) if lines and lines[-1] else None
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):self.handle_request()
 def do_POST(self):self.handle_request()
 def do_PATCH(self):self.handle_request()
 def do_PUT(self):self.handle_request()
 def send(self,value,status=200):
  self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(value).encode())
 def handle_request(self):
  try:
   u=urlparse(self.path);q={k:v[0] for k,v in parse_qs(u.query).items()};body=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))) or b'{}')
   token=self.headers.get('Authorization','').removeprefix('Bearer ');number=token.removeprefix('qa-token-');user=uid(number) if token.startswith('qa-token-') and number in accounts.values() else None
   if u.path=='/auth/v1/token':
    n=accounts.get(body.get('email'))
    if not n or body.get('password')!='Synthetic-test-only-42!':return self.send({'message':'Invalid credentials'},401)
    return self.send({'access_token':'qa-token-'+n,'refresh_token':'qa-refresh-'+n,'expires_in':3600,'token_type':'bearer','user':{'id':uid(n),'email':body['email']}})
   if not user:return self.send({'message':'Unauthorized'},401)
   if u.path=='/auth/v1/user':return self.send({'id':user,'email':next(e for e,n in accounts.items() if uid(n)==user)})
   if u.path=='/auth/v1/logout':return self.send({})
   if u.path.startswith('/rest/v1/rpc/'):
    name=u.path.rsplit('/',1)[1]
    if name=='instructor_sessions':return self.send(db("select coalesce(jsonb_agg(to_jsonb(r)),'[]') from instructor_sessions() r",user))
    if name in {'instructor_assignment_accounts','search_linkable_part_time_profiles'}:
     args=quote(body['p_session'])
     if name=='search_linkable_part_time_profiles':args+=','+quote(body['p_query'])+','+str(int(body['p_limit']))
     return self.send(db("select coalesce(jsonb_agg(to_jsonb(r)),'[]') from "+ident(name)+'('+args+') r',user))
    functions={'can_edit_session':['p_session_id','p_uid'],'can_plan_class':['p_session','p_class','p_week'],'save_instructor_schematic':['p_session','p_data']}
    if name not in functions:raise ValueError('Unsupported test RPC')
    args=','.join(quote(json.dumps(body[k]) if isinstance(body[k],dict) else body[k]) for k in functions[name])
    return self.send(db('select to_jsonb('+ident(name)+'('+args+'))',user))
   table=u.path.rsplit('/',1)[1]
   allowed={'profiles','teams','team_members','team_invites','sessions','schematics','instructor_assignments','instructor_classes','instructor_plans','session_shares'}
   if table not in allowed:raise ValueError('Unsupported test table '+table)
   filters=[]
   for k,v in q.items():
    if k in {'select','order','limit','on_conflict','or'}:continue
    if v.startswith('eq.'):filters.append(ident(k)+'='+quote(v[3:]))
    elif v.startswith('in.('):filters.append(ident(k)+' in ('+','.join(quote(x) for x in v[4:-1].split(','))+')')
    else:raise ValueError('Unsupported test filter')
   where=' where '+' and '.join(filters) if filters else ''
   if self.command=='GET':
    select=q.get('select','*')
    columns=[x for x in select.split(',') if re.fullmatch('[a-z_]+',x)] if select!='*' else []
    # Nested PostgREST relationships are not exercised by instructor metadata endpoints.
    projection=','.join(ident(x) for x in columns) if columns else '*'
    order=' order by '+','.join(ident(x.split('.')[0]) for x in q['order'].split(',')) if 'order' in q else ''
    limit=' limit '+str(min(int(q.get('limit','1000')),1000))
    return self.send(db("select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select "+projection+' from '+ident(table)+where+order+limit+') r',user))
   if table not in {'instructor_plans','instructor_assignments','schematics'}:raise ValueError('Unsupported test write')
   if self.command=='PATCH':sql='update '+ident(table)+' set '+','.join(ident(k)+'='+(quote(v) if v is not None else 'null') for k,v in body.items())+where+' returning *'
   else:
    keys=list(body);values=[quote(json.dumps(body[k]) if isinstance(body[k],(list,dict)) else body[k]) for k in keys]
    sql='insert into '+ident(table)+'('+','.join(ident(k) for k in keys)+') values('+','.join(values)+')'
    if 'on_conflict' in q:sql+=' on conflict('+','.join(ident(k) for k in q['on_conflict'].split(','))+') do update set '+','.join(ident(k)+'=excluded.'+ident(k) for k in keys)
    sql+=' returning *'
   self.send(db("with changed as ("+sql+") select coalesce(jsonb_agg(to_jsonb(changed)),'[]') from changed",user))
  except Exception as e:self.send({'message':str(e)},400)
ThreadingHTTPServer(('127.0.0.1',18081),Handler).serve_forever()
