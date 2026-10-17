import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Plus, Trash2, Users, Copy, Play, RotateCcw, Sparkles, Link2, Shield, Eye, EyeOff, Vote, Check, Settings2 } from "lucide-react";

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = envUrl && envKey ? createClient(envUrl, envKey) : null;
const DEFAULT_CATEGORIES = [
  { name: "After Dark", words: ["Secret affair", "Hotel suite", "Blind date", "Love bite", "Champagne", "Red room"] },
  { name: "Celebrities", words: ["Rihanna", "Zendaya", "Bad Bunny", "Margot Robbie", "Drake", "The Weeknd"] },
  { name: "Movies & TV", words: ["Euphoria", "Bridgerton", "Fight Club", "The Hangover", "Breaking Bad", "Barbie"] },
  { name: "Food & Drinks", words: ["Espresso martini", "Sushi", "Tiramisu", "Spicy margarita", "Oysters", "Tacos"] },
  { name: "Travel", words: ["Bali", "Dubai", "Las Vegas", "Santorini", "Tokyo", "Ibiza"] },
  { name: "Wild Cards", words: ["Handcuffs", "Penthouse", "Secret admirer", "Afterparty", "Flirting", "Ex"] },
];
const uid = () => Math.random().toString(36).slice(2, 9).toUpperCase();
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export default function App() {
  const [tab, setTab] = useState("setup");
  const [members, setMembers] = useState(() => read("ah-members", []));
  const [nameInput, setNameInput] = useState("");
  const [categories, setCategories] = useState(() => read("ah-categories", DEFAULT_CATEGORIES));
  const [selectedCats, setSelectedCats] = useState(() => read("ah-selected-cats", DEFAULT_CATEGORIES.map(c => c.name)));
  const [newCat, setNewCat] = useState("");
  const [newWords, setNewWords] = useState("");
  const [playerLimit, setPlayerLimit] = useState(6);
  const [imposterCount, setImposterCount] = useState(1);
  const [roomCode, setRoomCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joinName, setJoinName] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);
  const [mySecret, setMySecret] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [phase, setPhase] = useState("lobby");
  const [votes, setVotes] = useState({});
  const [voteTarget, setVoteTarget] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageMode, setImageMode] = useState(true);
  const [timer, setTimer] = useState(60);

  useEffect(() => write("ah-members", members), [members]);
  useEffect(() => write("ah-categories", categories), [categories]);
  useEffect(() => write("ah-selected-cats", selectedCats), [selectedCats]);

  useEffect(() => {
    if (!roomId || !supabase) return;
    const channel = supabase.channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `room_id=eq.${roomId}` }, () => refreshRoom())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` }, () => refreshRoom())
      .subscribe();
    refreshRoom();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function refreshRoom() {
    if (!supabase || !roomId) return;
    const { data: room } = await supabase.from("game_rooms").select("*").eq("id", roomId).maybeSingle();
    const { data: people } = await supabase.from("game_players").select("id,display_name,joined_at").eq("room_id", roomId).order("joined_at");
    if (people) setPlayers(people);
    if (room) {
      setPhase(room.phase || "lobby");
      setCurrentRound(room.round_number || 0);
    }
  }

  function addMember() {
    const clean = nameInput.trim().slice(0, 32);
    if (!clean) return;
    if (members.length >= 100) return setNotice("Member list is capped at 100.");
    if (members.some(m => m.toLowerCase() === clean.toLowerCase())) return setNotice("That member is already saved.");
    setMembers([...members, clean]); setNameInput(""); setNotice("");
  }
  function removeMember(name) { setMembers(members.filter(m => m !== name)); }
  function resetMembers() {
    if (confirm("Clear your entire saved member list?")) { setMembers([]); setNotice("Saved member list cleared."); }
  }
  function toggleCat(name) { setSelectedCats(old => old.includes(name) ? old.filter(x => x !== name) : [...old, name]); }
  function addCategory() {
    const name = newCat.trim();
    const words = newWords.split(",").map(x => x.trim()).filter(Boolean);
    if (!name || words.length < 2) return setNotice("Add a category name and at least two comma-separated words.");
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return setNotice("Category already exists.");
    setCategories([...categories, { name, words }]); setSelectedCats([...selectedCats, name]); setNewCat(""); setNewWords(""); setNotice("Category added.");
  }
  function deleteCategory(name) {
    setCategories(categories.filter(c => c.name !== name));
    setSelectedCats(selectedCats.filter(c => c !== name));
  }
  async function createRoom() {
    if (!supabase) return setNotice("Connect Supabase first. Follow README.md to add your project URL and anon key.");
    if (members.length < 3) return setNotice("Add at least 3 saved members, or use the invite flow for players joining individually.");
    if (members.length > 100) return setNotice("Maximum 100 players.");
    if (imposterCount < 1 || imposterCount >= members.length) return setNotice("Imposters must be at least 1 and fewer than players.");
    if (!selectedCats.length) return setNotice("Select at least one category.");
    setLoading(true); setNotice("");
    try {
      const code = uid().slice(0, 6);
      const { data: room, error } = await supabase.from("game_rooms").insert({
        room_code: code, phase: "lobby", max_players: playerLimit, imposter_count: imposterCount,
        selected_categories: selectedCats, image_mode: imageMode, discussion_seconds: timer
      }).select().single();
      if (error) throw error;
      setRoomId(room.id); setRoomCode(code); setIsHost(true); setTab("room");
      // Host can preload saved roster. Duplicate/invalid entries are filtered before insert.
      const roster = members.slice(0, playerLimit).map((display_name, i) => ({
        room_id: room.id, display_name, is_host: i === 0
      }));
      const { error: playerError } = await supabase.from("game_players").insert(roster);
      if (playerError) throw playerError;
      await refreshRoom();
      setNotice("Room created. Share the invite link with your group.");
    } catch (e) { setNotice(e.message || "Could not create room."); }
    finally { setLoading(false); }
  }
  async function joinRoom() {
    if (!supabase) return setNotice("Connect Supabase first. See README.md.");
    const code = roomCode.trim().toUpperCase();
    const name = joinName.trim();
    if (!code || !name) return setNotice("Enter a room code and your display name.");
    setLoading(true); setNotice("");
    try {
      const { data: room, error } = await supabase.from("game_rooms").select("*").eq("room_code", code).maybeSingle();
      if (error) throw error;
      if (!room) throw new Error("Room not found. Ask the host for a fresh invite link.");
      const { count } = await supabase.from("game_players").select("*", { count: "exact", head: true }).eq("room_id", room.id);
      if ((count || 0) >= room.max_players) throw new Error("This room is full.");
      const { error: addError } = await supabase.from("game_players").insert({ room_id: room.id, display_name: name, is_host: false });
      if (addError) throw addError;
      setRoomId(room.id); setIsHost(false); setTab("room"); await refreshRoom();
    } catch (e) { setNotice(e.message || "Could not join room."); }
    finally { setLoading(false); }
  }
  async function startGame() {
    if (!supabase || !isHost) return;
    if (players.length < 3) return setNotice("At least 3 players must join before starting.");
    if (imposterCount >= players.length) return setNotice("Imposters must be fewer than joined players.");
    const pool = categories.filter(c => selectedCats.includes(c.name));
    const wordList = pool.flatMap(c => c.words.map(word => ({ word, category: c.name })));
    if (!wordList.length) return setNotice("Selected categories have no words.");
    const chosen = wordList[Math.floor(Math.random() * wordList.length)];
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const imposters = new Set(shuffled.slice(0, Math.min(imposterCount, players.length - 1)).map(p => p.id));
    const assignments = players.map(p => ({ id: p.id, role: imposters.has(p.id) ? "imposter" : "civilian" }));
    // This starter keeps the word/role assignment local to the host view; use the secure RPC design in README before public launch.
    setCurrentRound({ ...chosen, assignments });
    setPhase("reveal"); setShowSecret(false); setNotice("Round started. Pass the device for private role reveals.");
    await supabase.from("game_rooms").update({ phase: "reveal", round_number: (currentRound || 0) + 1 }).eq("id", roomId);
  }
  async function beginVoting() {
    setVotes({}); setVoteTarget(""); setPhase("voting");
    if (supabase && roomId) await supabase.from("game_rooms").update({ phase: "voting" }).eq("id", roomId);
  }
  function castVote() {
    if (!voteTarget) return setNotice("Choose a player to vote for.");
    setVotes({ ...votes, [joinName || players[0]?.display_name || "You"]: voteTarget });
    setNotice("Vote recorded on this device.");
  }
  const tally = useMemo(() => Object.values(votes).reduce((acc, name) => ({ ...acc, [name]: (acc[name] || 0) + 1 }), {}), [votes]);
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?room=${roomCode}` : "";
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("room");
    if (invite) setRoomCode(invite.toUpperCase());
  }, []);

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setTab("setup"); }}><span className="brand-mark">A</span><span>AFTER<span className="accent">HOURS</span><small>THE IMPOSTER GAME</small></span></a>
      <div className="top-actions"><span className={`connection ${supabase ? "online" : "offline"}`}><i />{supabase ? "BACKEND CONFIGURED" : "SETUP REQUIRED"}</span><button className="icon-button" title="Settings" onClick={() => setTab("setup")}><Settings2 size={18}/></button></div>
    </header>
    <main>
      <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> THE PARTY GAME AFTER DARK</div>
        <h1>Trust <em>no one.</em><br/>Know the word.</h1>
        <p>One word. A room full of secrets. Find the Imposter before they figure you out.</p>
        <div className="hero-stats"><span><Users size={15}/> 3–100 PLAYERS</span><span><Shield size={15}/> SECRET ROLES</span><span><Vote size={15}/> LIVE VOTING</span></div>
      </section>

      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      <nav className="tabs">
        {[["setup","Game setup"],["members","Members"],["categories","Categories"],["room","Game room"]].map(([key,label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
      </nav>

      {tab === "setup" && <section className="panel-grid">
        <div className="panel">
          <div className="panel-heading"><div><span className="step">01 / LOBBY</span><h2>Build your room</h2></div><Users size={20}/></div>
          <label>Players in this room <strong>{playerLimit}</strong></label>
          <input type="range" min="3" max="100" value={playerLimit} onChange={e => setPlayerLimit(Number(e.target.value))}/>
          <div className="range-labels"><span>3 players</span><span>100 players</span></div>
          <label>Number of Imposters</label>
          <div className="counter"><button onClick={() => setImposterCount(Math.max(1, imposterCount - 1))}>−</button><strong>{imposterCount}</strong><button onClick={() => setImposterCount(Math.min(Math.max(1, playerLimit - 1), imposterCount + 1))}>+</button><span>At least 1, always fewer than players</span></div>
          <label>Discussion timer</label>
          <div className="select-row">{[30,60,90,120].map(n => <button key={n} className={timer === n ? "selected" : ""} onClick={() => setTimer(n)}>{n}s</button>)}</div>
          <label className="switch-row"><span><b>Word image mode</b><small>Civilians can see an image with their word.</small></span><input type="checkbox" checked={imageMode} onChange={e => setImageMode(e.target.checked)}/></label>
          <button className="primary full" onClick={createRoom} disabled={loading}><Play size={17}/>{loading ? "Creating room…" : "Create multiplayer room"}</button>
          <p className="microcopy">Rooms require Supabase configuration. See the included setup guide.</p>
        </div>
        <div className="panel side-panel">
          <span className="step">02 / JOIN IN</span><h2>Got an invite?</h2><p className="muted">Enter the code your host shared to join their room.</p>
          <label>Room code</label><input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="E.G. 8K2QPL" maxLength={8}/>
          <label>Your display name</label><input value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="What should we call you?" maxLength={32}/>
          <button className="secondary full" onClick={joinRoom} disabled={loading}><Link2 size={17}/>Join room</button>
          <div className="divider-label"><span>THE RULES</span></div>
          <div className="rule"><span>01</span><p>Civilians receive the secret word. The Imposter doesn't.</p></div>
          <div className="rule"><span>02</span><p>Give clues without making the word too obvious.</p></div>
          <div className="rule"><span>03</span><p>Vote for the player you think is faking it.</p></div>
        </div>
      </section>}

      {tab === "members" && <section className="panel">
        <div className="panel-heading"><div><span className="step">YOUR ROSTER</span><h2>Saved members <span className="count">{members.length}/100</span></h2></div><button className="text-button danger" onClick={resetMembers}><RotateCcw size={15}/> Reset list</button></div>
        <p className="muted">Keep your regular group saved in this browser. Saved members are a roster, not automatically connected players in a live room.</p>
        <div className="add-row"><input value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addMember()} placeholder="Enter a member name…" maxLength={32}/><button className="primary" onClick={addMember}><Plus size={17}/> Add member</button></div>
        <div className="member-list">{members.map((m,i) => <div className="member" key={`${m}-${i}`}><span className="avatar">{m.slice(0,1).toUpperCase()}</span><span>{m}</span><button className="icon-button danger" onClick={() => removeMember(m)} title={`Remove ${m}`}><Trash2 size={16}/></button></div>)}
          {!members.length && <div className="empty"><Users size={28}/><b>No saved members yet</b><span>Add your group to reuse names next time.</span></div>}</div>
        <button className="secondary" onClick={() => { setPlayerLimit(Math.max(3, Math.min(100, members.length))); setNotice("Player limit updated from saved roster."); setTab("setup"); }}>Use roster for setup</button>
      </section>}

      {tab === "categories" && <section className="panel">
        <div className="panel-heading"><div><span className="step">MAKE IT YOURS</span><h2>Word categories</h2></div><span className="count">{selectedCats.length} active</span></div>
        <p className="muted">Choose the vibe for your next round, or add your own category and word pack.</p>
        <div className="category-grid">{categories.map(cat => <div className={`category ${selectedCats.includes(cat.name) ? "enabled" : ""}`} key={cat.name}>
          <button className="category-toggle" onClick={() => toggleCat(cat.name)}><span className="check">{selectedCats.includes(cat.name) && <Check size={14}/>}</span><span><b>{cat.name}</b><small>{cat.words.length} words</small></span></button>
          <div className="word-chips">{cat.words.slice(0,5).map(w => <span key={w}>{w}</span>)}{cat.words.length > 5 && <span>+{cat.words.length-5}</span>}</div>
          <button className="delete-category" onClick={() => deleteCategory(cat.name)}><Trash2 size={14}/> Remove category</button>
        </div>)}</div>
        <div className="add-category"><h3><Plus size={17}/> Create a custom category</h3><label>Category name</label><input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="e.g. Chaotic Confessions"/><label>Words (comma-separated; at least 2)</label><textarea value={newWords} onChange={e => setNewWords(e.target.value)} placeholder="Secret crush, rooftop party, ex's text, …" rows={3}/><button className="primary" onClick={addCategory}><Plus size={16}/> Save category</button></div>
      </section>}

      {tab === "room" && <section className="panel">
        <div className="panel-heading"><div><span className="step">MULTIPLAYER</span><h2>Game room</h2></div><span className="phase-pill">{phase.toUpperCase()}</span></div>
        {!roomId ? <div className="empty"><Link2 size={28}/><b>No room active</b><span>Create a room or join one with an invite code.</span><button className="secondary" onClick={() => setTab("setup")}>Go to setup</button></div> : <>
          <div className="room-code"><div><small>ROOM CODE</small><strong>{roomCode}</strong></div><button className="secondary" onClick={() => { navigator.clipboard?.writeText(inviteUrl); setNotice("Invite link copied."); }}><Copy size={16}/> Copy invite link</button></div>
          <div className="room-meta"><span><Users size={16}/> {players.length} joined</span><span>Capacity: {playerLimit}</span><span>{isHost ? "You are host" : "You are a player"}</span></div>
          <div className="member-list">{players.map((p,i) => <div className="member" key={p.id}><span className="avatar">{(p.display_name || "?").slice(0,1).toUpperCase()}</span><span>{p.display_name}</span>{i === 0 && <span className="host-tag">HOST</span>}</div>)}</div>
          {isHost && phase === "lobby" && <button className="primary full" onClick={startGame}><Play size={17}/> Start round</button>}
          {phase === "reveal" && <div className="game-stage"><span className="step">PRIVATE REVEAL</span><h3>Pass the device</h3><p className="muted">Each player must privately reveal their role. Keep the screen hidden from everyone else.</p>
            {currentRound?.assignments?.map((a,i) => <div className="reveal-row" key={a.id}><span>{players.find(p => p.id === a.id)?.display_name || `Player ${i+1}`}</span><button className="secondary" onClick={() => { setMySecret(a.role === "imposter" ? { role:"imposter" } : { role:"civilian", word:currentRound.word, category:currentRound.category }); setShowSecret(false); }}><Eye size={15}/> Reveal</button></div>)}
            {mySecret && <div className={`secret-card ${mySecret.role}`}><span>{mySecret.role === "imposter" ? "YOUR ROLE" : `CIVILIAN · ${mySecret.category}`}</span><h3>{mySecret.role === "imposter" ? "You are the IMPOSTER" : mySecret.word}</h3>{mySecret.role === "imposter" ? <p>Blend in. Listen closely. Figure out the secret word.</p> : imageMode && <img alt={mySecret.word} src={`https://images.unsplash.com/featured/480x320?${encodeURIComponent(mySecret.word)}`} onError={e => { e.currentTarget.style.display = "none"; }}/>}<button className="secondary" onClick={() => { setMySecret(null); setShowSecret(false); }}><EyeOff size={15}/> Hide secret</button></div>}
            {isHost && <button className="primary full" onClick={beginVoting}><Vote size={17}/> Start voting</button>}
          </div>}
          {phase === "voting" && <div className="game-stage"><span className="step">CAST YOUR VOTE</span><h3>Who is the Imposter?</h3><p className="muted">Choose the player you suspect. Each player should vote once.</p><div className="vote-options">{players.map(p => <button className={voteTarget === p.display_name ? "selected" : ""} key={p.id} onClick={() => setVoteTarget(p.display_name)}>{p.display_name}</button>)}</div><button className="primary full" onClick={castVote}><Vote size={17}/> Submit vote</button><p className="microcopy">This starter demo records votes on the current device; secure per-player voting is required before public launch.</p>{Object.keys(tally).length > 0 && <div className="results"><h3>Current tally</h3>{Object.entries(tally).map(([name,n]) => <div key={name} className="tally-row"><span>{name}</span><b>{n} vote{n !== 1 ? "s" : ""}</b></div>)}</div>}</div>}
          <button className="text-button danger" onClick={() => { if(confirm("Leave this room view?")) { setRoomId(""); setRoomCode(""); setPlayers([]); setPhase("lobby"); setCurrentRound(null); setMySecret(null); setTab("setup"); } }}>Leave room</button>
        </>}
      </section>}
      <footer><span>AFTERHOURS © 2026</span><span>KEEP IT SECRET. KEEP IT FUN.</span></footer>
    </main>
  </div>;
}