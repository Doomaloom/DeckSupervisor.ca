package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"cob-aquatics/internal/services/attendance"
)

type Fixture struct { Name string `json:"name"`; SourceCommit string `json:"sourceCommit"`; Request any `json:"request"`; SHA256 string `json:"sha256"` }
func main() {
	root := os.Getenv("PDF_GOLDEN_OUTPUT"); if root == "" { panic("PDF_GOLDEN_OUTPUT is required") }
	entries, err := os.ReadDir("swimming attendance"); if err != nil { panic(err) }
	names := []string{}
	for _, entry := range entries { if strings.HasSuffix(entry.Name(), ".html") { names = append(names, strings.TrimSuffix(strings.ReplaceAll(entry.Name(), " ", ""), ".html")) } }
	sort.Strings(names)
	manifest := struct { SourceCommit string `json:"sourceCommit"`; Fixtures []Fixture `json:"fixtures"` }{SourceCommit:"c315c452d8c0b3aabfff324f702f89aee3ce8a2e"}
	students := []attendance.Student{{Name:"Avery Adams"},{Name:"Blair Brown"},{Name:"Casey Chen"}}
	for _, name := range names {
		req := attendance.Request{Template:name, Session:"Summer 2026", Filename:"attendance-"+name, Title:name, Roster:attendance.Roster{Code:"00123",Level:name,ServiceName:name,Time:"9:00 AM",Instructor:"Alex Instructor",Location:"Main Pool",Schedule:"Mon 2026-07-06",Students:students}}
		data, _, err := attendance.Generate(context.Background(), req); if err != nil { panic(fmt.Errorf("%s: %w",name,err)) }
		file := "attendance-"+name+".pdf"; if err:=os.WriteFile(filepath.Join(root,file),data,0644);err!=nil{panic(err)}
		sum:=sha256.Sum256(data); manifest.Fixtures=append(manifest.Fixtures,Fixture{Name:file,SourceCommit:manifest.SourceCommit,Request:req,SHA256:hex.EncodeToString(sum[:])})
	}
	data,_:=json.MarshalIndent(manifest,"","  "); if err:=os.WriteFile(filepath.Join(root,"manifest.json"),append(data,'\n'),0644);err!=nil{panic(err)}
}
