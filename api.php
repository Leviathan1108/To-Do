<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$HOST='127.0.0.1'; $PORT=3306; $DB='todo'; $USER='root'; $PASS='';
try {
  $pdo=new PDO("mysql:host=$HOST;port=$PORT;dbname=$DB;charset=utf8mb4",$USER,$PASS,[
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC
  ]);
} catch(Throwable $e){ http_response_code(500); echo json_encode(['error'=>'DB connect fail','msg'=>$e->getMessage()]); exit; }

$method=$_SERVER['REQUEST_METHOD'];
$input=json_decode(file_get_contents('php://input'),true) ?? [];

if($method==='GET'){
  $filter=$_GET['filter']??'all';
  $sql="SELECT id,text,done,created_at FROM todos ORDER BY created_at DESC";
  if($filter==='active') $sql="SELECT id,text,done,created_at FROM todos WHERE done=0 ORDER BY created_at DESC";
  if($filter==='completed') $sql="SELECT id,text,done,created_at FROM todos WHERE done=1 ORDER BY created_at DESC";
  echo json_encode($pdo->query($sql)->fetchAll());
  exit;
}
if($method==='POST'){
  $text=trim($input['text']??'');
  if($text===''){ http_response_code(400); echo json_encode(['error'=>'text required']); exit; }
  $id=bin2hex(random_bytes(8));
  $now=(int)(microtime(true)*1000);
  $stmt=$pdo->prepare("INSERT INTO todos(id,text,done,created_at) VALUES(?,?,0,?)");
  $stmt->execute([$id,$text,$now]);
  echo json_encode(['id'=>$id,'text'=>$text,'done'=>0,'created_at'=>$now]);
  exit;
}
if($method==='PUT'){
  $id=$_GET['id']??$input['id']??'';
  if(!$id){ http_response_code(400); echo json_encode(['error'=>'id required']); exit; }
  $fields=[]; $params=[];
  if(array_key_exists('text',$input)){ $fields[]="text=?"; $params[]=trim($input['text']); }
  if(array_key_exists('done',$input)){ $fields[]="done=?"; $params[]=$input['done']?1:0; }
  if(!$fields){ http_response_code(400); echo json_encode(['error'=>'no fields']); exit; }
  $params[]=$id;
  $pdo->prepare("UPDATE todos SET ".implode(',',$fields)." WHERE id=?")->execute($params);
  $row=$pdo->prepare("SELECT id,text,done,created_at FROM todos WHERE id=?"); $row->execute([$id]);
  echo json_encode($row->fetch() ?: ['ok'=>true]);
  exit;
}
if($method==='DELETE'){
  if(isset($_GET['clear']) && $_GET['clear']==='completed'){
    $n=$pdo->exec("DELETE FROM todos WHERE done=1");
    echo json_encode(['deleted'=>$n]); exit;
  }
  $id=$_GET['id']??$input['id']??'';
  if(!$id){ http_response_code(400); echo json_encode(['error'=>'id required']); exit; }
  $pdo->prepare("DELETE FROM todos WHERE id=?")->execute([$id]);
  echo json_encode(['deleted'=>1]); exit;
}
http_response_code(405); echo json_encode(['error'=>'method not allowed']);
