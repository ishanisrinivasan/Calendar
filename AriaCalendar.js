import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = ["#FF6B6B","#4ECDC4","#45B7D1","#96CEB4","#FFEAA7",
  "#DDA0DD","#98D8C8","#F7DC6F","#BB8FCE","#85C1E9","#F0A500","#6BCB77"];
const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const ATTENDANCE = {
  mandatory:{ label:"Mandatory", color:"#FF6B6B", icon:"🔴" },
  optional: { label:"Optional",  color:"#4ECDC4", icon:"🟢" },
  unknown:  { label:"Unknown",   color:"#555",    icon:"⚪" }
};

function scheduleNotification(event) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const msRem = new Date(event.date).getTime() - event.reminder * 60000 - Date.now();
  const msNow = new Date(event.date).getTime() - Date.now();
  if (msRem > 0) setTimeout(() => new Notification(`⏰ Reminder: ${event.title}`,
    { body: `Starting in ${event.reminder} minutes` }), msRem);
  if (msNow > 0 && msNow < 86400000) setTimeout(() => new Notification(`🗓️ Now: ${event.title}`,
    { body: "Your event is starting now!" }), msNow);
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

export default function AriaCalendar() {
  const [events, setEvents] = useState(() => {
    try {
      const saved = localStorage.getItem('aria_events');
      if (saved) {
        return JSON.parse(saved).map(e => ({ ...e, date: new Date(e.date) }));
      }
    } catch(e) {}
    return [
      { id:1, title:"Team Standup", date:(() => { const d=new Date(); d.setHours(10,0,0,0); return d; })(), reminder:10, color:"#4ECDC4", attendance:"unknown", isClass:false },
      { id:2, title:"Lunch with Sarah", date:(() => { const d=new Date(); d.setDate(d.getDate()+1); d.setHours(12,30,0,0); return d; })(), reminder:15, color:"#FF6B6B", attendance:"unknown", isClass:false },
    ];
  });

  // Persist events to localStorage
  useEffect(() => {
    localStorage.setItem('aria_events', JSON.stringify(events));
  }, [events]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [chatMessages, setChatMessages] = useState([{
    role:"ai",
    text:"Hi! I'm Aria ✨\n\n• 🗓️ Type to plan events\n• 📷 Upload your school timetable\n• 🔴🟢 Tell me which classes are mandatory\n\nTry: \"Add gym tomorrow at 7am\""
  }]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notifPerm, setNotifPerm] = useState("Notification" in window ? Notification.permission : "unsupported");
  const [view, setView] = useState("chat"); // "chat" | "calendar" | "classes"
  const [scanPreview, setScanPreview] = useState(null);
  const chatEndRef = useRef(null);
  const fileRef = useRef(null);
  const nextId = useRef(100);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatMessages]);

  const addMsg = (role, text) => setChatMessages(p => [...p, { role, text }]);

  const requestNotif = async () => {
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  };

  // ── Image timetable scan ────────────────────────────────────────────────
  const handleImageUpload = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const previewUrl = URL.createObjectURL(file);
    setScanPreview(previewUrl);
    setScanning(true);
    setView("chat");
    addMsg("user", "📷 [Uploaded school timetable]");
    addMsg("ai", "📷 Scanning your timetable… extracting all classes!");

    try {
      const b64 = await fileToBase64(file);
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:2000,
          messages:[{
            role:"user",
            content:[
              { type:"image", source:{ type:"base64", media_type:file.type, data:b64 } },
              { type:"text", text:`Extract ALL classes from this school timetable image.
Return ONLY a valid JSON array, no markdown.
Each item: { "title": "Subject", "dayOfWeek": 0-6 (0=Sun), "startTime": "HH:MM", "endTime": "HH:MM", "location": "room or null" }
Today: ${new Date().toISOString()}` }
            ]
          }]
        })
      });
      const data = await resp.json();
      const raw = data.content?.[0]?.text || "[]";
      const classes = JSON.parse(raw.replace(/```json|```/g,"").trim());

      if (!Array.isArray(classes) || classes.length === 0) {
        addMsg("ai","Couldn't read classes from that image. Try a clearer photo.");
        setScanning(false); return;
      }

      const newEvents = [];
      const today = new Date();
      const colorMap = {};
      for (const cls of classes) {
        if (!colorMap[cls.title]) colorMap[cls.title] = COLORS[Object.keys(colorMap).length % COLORS.length];
        for (let week = 0; week < 12; week++) {
          const diff = (cls.dayOfWeek - today.getDay() + 7) % 7 + week * 7;
          const d = new Date(today);
          d.setDate(d.getDate() + diff);
          const [h,m] = (cls.startTime||"09:00").split(":").map(Number);
          d.setHours(h, m, 0, 0);
          if (d < today) continue;
          newEvents.push({ id:nextId.current++, title:cls.title, date:new Date(d),
            reminder:15, color:colorMap[cls.title], attendance:"unknown",
            isClass:true, location:cls.location||null, endTime:cls.endTime||null });
        }
      }

      setEvents(p => [...p, ...newEvents]);
      const uniqueClasses = [...new Set(classes.map(c => c.title))];
      addMsg("ai", `✅ Found ${uniqueClasses.length} class(es):\n\n${uniqueClasses.map(c=>`• ${c}`).join("\n")}\n\nAdded for 12 weeks! 🎉\n\nNow tell me which are mandatory:\n"${uniqueClasses[0]} is mandatory"`);
      setView("classes");
    } catch(e) {
      addMsg("ai","Something went wrong. Try again with a clearer photo!");
    }
    setScanning(false);
  };

  // ── Chat handler ────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setInput("");
    addMsg("user", userText);
    setProcessing(true);

    const classNames = [...new Set(events.filter(e=>e.isClass).map(e=>e.title))];

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:800,
          system:`You are Aria, an AI calendar assistant.
Current date: ${new Date().toISOString()}
Classes in calendar: ${JSON.stringify(classNames)}
Recent events: ${JSON.stringify(events.slice(-6).map(e=>({ id:e.id, title:e.title, date:new Date(e.date).toISOString(), attendance:e.attendance, isClass:e.isClass })))}

Return ONLY valid JSON (no markdown):
{
  "action": "add"|"update"|"delete"|"set_attendance"|"query",
  "title": "event name",
  "date": "ISO date",
  "time": "HH:MM 24h",
  "reminder": number,
  "matchTitle": "partial title lowercase",
  "newTime": "HH:MM",
  "newDate": "ISO date",
  "attendance": "mandatory"|"optional"|"unknown",
  "applyToAll": true,
  "response": "friendly reply with emoji"
}
Rules:
- "X optional"/"X not mandatory"/"X no attendance" → set_attendance, attendance="optional"
- "X mandatory"/"X requires attendance" → set_attendance, attendance="mandatory"
- Natural dates: tomorrow, next Monday, etc.`,
          messages:[{ role:"user", content:userText }]
        })
      });

      const data = await resp.json();
      const raw = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(raw.replace(/```json|```/g,"").trim());

      if (parsed.action === "add") {
        const [h,m] = (parsed.time||"09:00").split(":").map(Number);
        const d = parsed.date ? new Date(parsed.date) : new Date();
        d.setHours(h, m, 0, 0);
        const ev = { id:nextId.current++, title:parsed.title||"New Event", date:d,
          reminder:parsed.reminder||15, color:COLORS[Math.floor(Math.random()*COLORS.length)],
          attendance:"unknown", isClass:false };
        setEvents(p => [...p, ev]);
        scheduleNotification(ev);
        setSelectedDate(new Date(d));
        setCurrentDate(new Date(d));
        addMsg("ai", parsed.response || `✅ Added "${ev.title}" — ${d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} at ${d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`);

      } else if (parsed.action === "delete") {
        const match = (parsed.matchTitle||"").toLowerCase();
        setEvents(p => {
          const found = p.find(e => e.title.toLowerCase().includes(match));
          if (found) { addMsg("ai", parsed.response||`🗑️ Deleted "${found.title}"`); return p.filter(e=>e.id!==found.id); }
          addMsg("ai","I couldn't find that event."); return p;
        });

      } else if (parsed.action === "update") {
        const match = (parsed.matchTitle||"").toLowerCase();
        setEvents(p => {
          const idx = p.findIndex(e => e.title.toLowerCase().includes(match));
          if (idx===-1) { addMsg("ai","Couldn't find that event."); return p; }
          const upd=[...p]; const ev={...upd[idx]};
          if (parsed.newTime) { const [h,m]=parsed.newTime.split(":").map(Number); const d=new Date(ev.date); d.setHours(h,m,0,0); ev.date=d; }
          if (parsed.newDate) { const d=new Date(parsed.newDate); d.setHours(new Date(ev.date).getHours(),new Date(ev.date).getMinutes(),0,0); ev.date=d; }
          upd[idx]=ev; scheduleNotification(ev);
          addMsg("ai", parsed.response||`✏️ Updated "${ev.title}"`);
          return upd;
        });

      } else if (parsed.action === "set_attendance") {
        const match = (parsed.matchTitle||"").toLowerCase();
        const att = parsed.attendance || "unknown";
        setEvents(p => {
          const updated = p.map(e => e.title.toLowerCase().includes(match) ? {...e, attendance:att} : e);
          const count = updated.filter(e=>e.title.toLowerCase().includes(match)).length;
          if (count > 0) addMsg("ai", parsed.response || `${ATTENDANCE[att].icon} Set ${count} session(s) → ${ATTENDANCE[att].label}`);
          else addMsg("ai",`Couldn't find "${match}".`);
          return updated;
        });

      } else {
        addMsg("ai", parsed.response || "Try adding an event or uploading your timetable 📷");
      }
    } catch(err) {
      addMsg("ai","Something went wrong. Try again!");
    }
    setProcessing(false);
  }, [input, events]);

  // ── Calendar helpers ────────────────────────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const eventsOnDay = d => events.filter(e => {
    const ed=new Date(e.date);
    return ed.getFullYear()===year&&ed.getMonth()===month&&ed.getDate()===d;
  });
  const selectedDayEvents = events.filter(e => {
    const ed=new Date(e.date), sd=selectedDate;
    return ed.getFullYear()===sd.getFullYear()&&ed.getMonth()===sd.getMonth()&&ed.getDate()===sd.getDate();
  }).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const isToday = d => { const t=new Date(); return d===t.getDate()&&month===t.getMonth()&&year===t.getFullYear(); };
  const isSelected = d => d===selectedDate.getDate()&&month===selectedDate.getMonth()&&year===selectedDate.getFullYear();

  const classGroups = {};
  events.filter(e=>e.isClass).forEach(e => {
    if (!classGroups[e.title]) classGroups[e.title] = { title:e.title, color:e.color, attendance:e.attendance, count:0, next:null };
    classGroups[e.title].count++;
    const d=new Date(e.date);
    if (d>=new Date()&&(!classGroups[e.title].next||d<new Date(classGroups[e.title].next))) classGroups[e.title].next=e.date;
    // keep latest attendance
    classGroups[e.title].attendance = e.attendance;
  });

  const todayEvents = events.filter(e => {
    const ed=new Date(e.date), t=new Date();
    return ed.getFullYear()===t.getFullYear()&&ed.getMonth()===t.getMonth()&&ed.getDate()===t.getDate();
  }).sort((a,b)=>new Date(a.date)-new Date(b.date));

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ height:"100dvh", background:"#070a12", fontFamily:"'Outfit',sans-serif", color:"#dde2f0", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Sora:wght@700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:2px;}
        ::-webkit-scrollbar-thumb{background:#1a1f35;border-radius:2px;}
        input{outline:none;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shim{0%,100%{opacity:.4}50%{opacity:1}}
        .msg{animation:fadeUp .25s ease;}
        .spin{animation:spin 1s linear infinite;}
        .shim{animation:shim 1.2s infinite;}
        .att-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;}
        .nav-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:none;border:none;cursor:pointer;padding:8px 12px;border-radius:12px;transition:all .2s;font-family:inherit;}
        .nav-btn.active{background:rgba(99,102,241,0.15);}
        .nav-btn span{font-size:10px;font-weight:600;letter-spacing:.4px;}
        .qpill{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:#44485e;border-radius:20px;padding:6px 13px;font-size:12px;cursor:pointer;font-weight:500;transition:all .15s;font-family:inherit;white-space:nowrap;}
      `}</style>

      {/* Top bar */}
      <div style={{ padding:"env(safe-area-inset-top, 12px) 20px 12px", paddingTop:`max(env(safe-area-inset-top), 12px)`, background:"rgba(7,10,18,0.95)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between", zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>✦</div>
          <div style={{ fontFamily:"'Sora',sans-serif",fontSize:17,fontWeight:700 }}>Aria <span style={{ color:"#6366f1" }}>Calendar</span></div>
        </div>
        {notifPerm==="granted"
          ? <div style={{ fontSize:11,color:"#4ECDC4",fontWeight:500 }}>🔔 On</div>
          : notifPerm!=="unsupported" && <button onClick={requestNotif} style={{ background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",color:"#a5b4fc",padding:"5px 10px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit" }}>🔔 Reminders</button>
        }
      </div>

      {/* Main content area */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

        {/* CHAT VIEW */}
        {view==="chat"&&(
          <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
            {scanPreview&&(
              <div style={{ padding:"8px 16px",background:"rgba(99,102,241,0.07)",borderBottom:"1px solid rgba(99,102,241,0.14)",display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
                <img src={scanPreview} alt="timetable" style={{ height:32,borderRadius:5,objectFit:"cover" }}/>
                <div style={{ fontSize:12,color:"#7879f1",flex:1 }}>{scanning?"🔍 Scanning…":"✅ Scanned"}</div>
                {scanning&&<div className="spin" style={{ width:14,height:14,border:"2px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%" }}/>}
                <button onClick={()=>setScanPreview(null)} style={{ background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:18 }}>×</button>
              </div>
            )}
            <div style={{ flex:1,overflow:"auto",padding:"16px 16px 8px",display:"flex",flexDirection:"column",gap:10 }}>
              {chatMessages.map((msg,i)=>(
                <div key={i} className="msg" style={{ display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",gap:7,alignItems:"flex-end" }}>
                  {msg.role==="ai"&&<div style={{ width:24,height:24,borderRadius:7,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,flexShrink:0 }}>✦</div>}
                  <div style={{ maxWidth:"80%",background:msg.role==="user"?"linear-gradient(135deg,#6366f1,#8b5cf6)":"rgba(255,255,255,0.05)",border:msg.role==="ai"?"1px solid rgba(255,255,255,0.07)":"none",borderRadius:msg.role==="user"?"15px 15px 4px 15px":"4px 15px 15px 15px",padding:"10px 13px",fontSize:14,lineHeight:1.6,color:msg.role==="user"?"#fff":"#b8c0d8",whiteSpace:"pre-wrap",wordBreak:"break-word" }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {processing&&(
                <div style={{ display:"flex",gap:7,alignItems:"flex-end" }}>
                  <div style={{ width:24,height:24,borderRadius:7,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11 }}>✦</div>
                  <div className="shim" style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"4px 15px 15px 15px",padding:"10px 13px",fontSize:13,color:"#333a52" }}>Thinking…</div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>
            {/* Quick pills */}
            <div style={{ padding:"0 12px 6px",display:"flex",gap:6,overflowX:"auto",flexShrink:0 }}>
              {["Add gym tomorrow 7am","Math is mandatory","History is optional","Delete standup"].map(s=>(
                <button key={s} className="qpill" onClick={()=>setInput(s)}>{s}</button>
              ))}
            </div>
            {/* Input */}
            <div style={{ padding:"6px 12px",padding:`6px 12px calc(6px + env(safe-area-inset-bottom))`,display:"flex",gap:8,alignItems:"center",flexShrink:0,background:"rgba(7,10,18,0.9)",borderTop:"1px solid rgba(255,255,255,0.05)" }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ if(e.target.files[0]) handleImageUpload(e.target.files[0]); e.target.value=""; }}/>
              <button onClick={()=>fileRef.current.click()} style={{ width:42,height:42,borderRadius:11,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.22)",color:"#6366f1",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>📷</button>
              <div style={{ flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,display:"flex",alignItems:"center",padding:"3px 3px 3px 13px" }}>
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder="Add event, set attendance…" style={{ flex:1,background:"transparent",border:"none",color:"#dde2f0",fontSize:14,padding:"9px 0",fontFamily:"inherit" }}/>
              </div>
              <button onClick={handleSend} disabled={processing||!input.trim()} style={{ width:42,height:42,borderRadius:11,background:processing||!input.trim()?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"white",cursor:processing||!input.trim()?"not-allowed":"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>↑</button>
            </div>
          </div>
        )}

        {/* CALENDAR VIEW */}
        {view==="calendar"&&(
          <div style={{ flex:1,overflow:"auto",padding:"16px" }}>
            {/* Today's events strip */}
            {todayEvents.length>0&&(
              <div style={{ marginBottom:16,padding:"12px 14px",background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:12 }}>
                <div style={{ fontSize:10,color:"#6366f1",fontWeight:700,letterSpacing:1,marginBottom:8 }}>TODAY</div>
                {todayEvents.map(e=>(
                  <div key={e.id} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                    <div style={{ width:7,height:7,borderRadius:"50%",background:e.attendance==="mandatory"?"#FF6B6B":e.attendance==="optional"?"#4ECDC4":e.color,flexShrink:0 }}/>
                    <div style={{ fontSize:13,color:"#dde2f0",flex:1 }}>{e.title}</div>
                    <div style={{ fontSize:11,color:"#444" }}>{new Date(e.date).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Month nav */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
              <div style={{ fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:700 }}>{MONTHS[month]} <span style={{ color:"#222740" }}>{year}</span></div>
              <div style={{ display:"flex",gap:4 }}>
                {["‹","›"].map((ch,i)=>(
                  <button key={i} onClick={()=>{ const d=new Date(currentDate); d.setMonth(d.getMonth()+(i?1:-1)); setCurrentDate(d); }} style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",color:"#aaa",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}>{ch}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4 }}>
              {DAYS_SHORT.map(d=><div key={d} style={{ textAlign:"center",fontSize:10,color:"#2a2f42",fontWeight:700,letterSpacing:.6,padding:"3px 0" }}>{d}</div>)}
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3 }}>
              {Array(firstDay).fill(null).map((_,i)=><div key={`e${i}`}/>)}
              {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>{
                const dayEvts=eventsOnDay(d);
                return (
                  <div key={d} onClick={()=>setSelectedDate(new Date(year,month,d))} style={{ padding:"6px 2px",borderRadius:8,textAlign:"center",background:isSelected(d)?"rgba(99,102,241,0.18)":"transparent",border:isSelected(d)?"1px solid rgba(99,102,241,0.4)":isToday(d)?"1px solid rgba(99,102,241,0.2)":"1px solid transparent",cursor:"pointer" }}>
                    <div style={{ fontSize:14,fontWeight:isToday(d)?700:400,color:isToday(d)?"#fff":isSelected(d)?"#a5b4fc":"#777",marginBottom:3 }}>{d}</div>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:2,justifyContent:"center" }}>
                      {dayEvts.slice(0,3).map(e=><div key={e.id} style={{ width:5,height:5,borderRadius:"50%",background:e.attendance==="mandatory"?"#FF6B6B":e.attendance==="optional"?"#4ECDC4":e.color }}/>)}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Selected day */}
            {selectedDayEvents.length>0&&(
              <div style={{ marginTop:20 }}>
                <div style={{ fontSize:11,color:"#2e3550",fontWeight:700,letterSpacing:1,marginBottom:10 }}>
                  {selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}).toUpperCase()}
                </div>
                {selectedDayEvents.map(e=>{
                  const att=ATTENDANCE[e.attendance||"unknown"];
                  return (
                    <div key={e.id} style={{ background:`${e.color}11`,border:`1px solid ${e.color}28`,borderLeft:`3px solid ${e.color}`,borderRadius:10,padding:"10px 13px",marginBottom:8 }}>
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
                        <div style={{ fontSize:14,fontWeight:600,color:"#e0e4f5" }}>{e.title}</div>
                        {e.isClass&&<span className="att-badge" style={{ background:`${att.color}20`,color:att.color }}>{att.icon} {att.label}</span>}
                      </div>
                      <div style={{ fontSize:12,color:"#44485e",display:"flex",gap:8 }}>
                        <span>🕐 {new Date(e.date).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                        {e.location&&<span>📍 {e.location}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CLASSES VIEW */}
        {view==="classes"&&(
          <div style={{ flex:1,overflow:"auto",padding:"16px" }}>
            <div style={{ fontSize:11,color:"#2a2f42",fontWeight:700,letterSpacing:1.3,marginBottom:12 }}>YOUR CLASSES</div>
            {Object.keys(classGroups).length===0?(
              <div style={{ textAlign:"center",paddingTop:60,color:"#1a1f30" }}>
                <div style={{ fontSize:48,marginBottom:12 }}>📷</div>
                <div style={{ fontSize:14,lineHeight:1.7,color:"#2a2f42" }}>Tap the 💬 Chat tab and use the<br/>📷 button to upload your timetable!</div>
              </div>
            ):Object.values(classGroups).map(cls=>{
              const att=ATTENDANCE[cls.attendance||"unknown"];
              return (
                <div key={cls.title} style={{ background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderLeft:`3px solid ${cls.color}`,borderRadius:12,padding:"13px 15px",marginBottom:10 }}>
                  <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600,fontSize:15,color:"#e0e4f5",marginBottom:4 }}>{cls.title}</div>
                      <div style={{ fontSize:12,color:"#2e3550" }}>{cls.count} sessions</div>
                      {cls.next&&<div style={{ fontSize:12,color:"#333a52",marginTop:3 }}>Next: {new Date(cls.next).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} · {new Date(cls.next).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>}
                    </div>
                    <span className="att-badge" style={{ background:`${att.color}1e`,color:att.color,flexShrink:0,marginTop:2 }}>{att.icon} {att.label}</span>
                  </div>
                </div>
              );
            })}
            {Object.keys(classGroups).length>0&&(
              <div style={{ padding:"12px 14px",background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:10,fontSize:12,color:"#6366f1",lineHeight:1.6,marginTop:4 }}>
                💡 Go to Chat to update attendance, e.g. "Math is mandatory"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ background:"rgba(7,10,18,0.95)", backdropFilter:"blur(12px)", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", justifyContent:"space-around", padding:`10px 0 calc(10px + env(safe-area-inset-bottom))`, flexShrink:0, zIndex:10 }}>
        {[
          { key:"chat",    icon:"💬", label:"CHAT"     },
          { key:"calendar",icon:"📅", label:"CALENDAR"  },
          { key:"classes", icon:"🎓", label:"CLASSES"   },
        ].map(tab=>(
          <button key={tab.key} className={`nav-btn${view===tab.key?" active":""}`} onClick={()=>setView(tab.key)}>
            <span style={{ fontSize:22 }}>{tab.icon}</span>
            <span style={{ color:view===tab.key?"#a5b4fc":"#2e3550" }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
