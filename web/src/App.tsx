import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, apiUrl, ApiError, type BoardDetail, type BoardSummary, type ClienteResumo, type UserProfile } from './api'
import { Bell, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, FileText, Gavel, LayoutGrid, LoaderCircle, LogOut, Menu, MoreHorizontal, Plus, RefreshCw, Search, Settings2, SlidersHorizontal, Users, X } from 'lucide-react'

const API_TOKEN_KEY = 'adlo.accessToken'
const columnColors = ['#7c8798', '#d99535', '#8172d5', '#4276d5', '#ce7957', '#3d9b77', '#798899']

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a solicitação.'
}

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(API_TOKEN_KEY))
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [boardId, setBoardId] = useState('')
  const [board, setBoard] = useState<BoardDetail | null>(null)
  const [clients, setClients] = useState<ClienteResumo[]>([])
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [boardLoading, setBoardLoading] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [pageError, setPageError] = useState('')
  const [query, setQuery] = useState('')
  const [areaFilter, setAreaFilter] = useState<'TODAS' | 'INSS' | 'DPVAT'>('TODAS')
  const [modal, setModal] = useState(false)
  const [processTitle, setProcessTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [area, setArea] = useState<'INSS' | 'DPVAT'>('INSS')
  const [mobileNav, setMobileNav] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [busyCard, setBusyCard] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const logout = useCallback(() => {
    sessionStorage.removeItem(API_TOKEN_KEY)
    setToken(null)
    setProfile(null)
    setBoard(null)
    setBoards([])
    setClients([])
    setPageError('')
  }, [])

  const handleApiError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      logout()
      return
    }
    setPageError(errorMessage(error))
  }, [logout])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setWorkspaceLoading(true)
    setPageError('')
    Promise.all([api.profile(token), api.boards(token)])
      .then(async ([user, boardList]) => {
        const clientPage = await api.clients(token, user.id)
        if (cancelled) return
        setProfile(user)
        setBoards(boardList)
        setClients(clientPage.items.filter(client => client.ativo))
        setBoardId(current => boardList.some(item => item.id === current) ? current : boardList[0]?.id ?? '')
      })
      .catch(error => { if (!cancelled) handleApiError(error) })
      .finally(() => { if (!cancelled) setWorkspaceLoading(false) })
    return () => { cancelled = true }
  }, [token, reloadKey, handleApiError])

  useEffect(() => {
    if (!token || !boardId) { setBoard(null); return }
    let cancelled = false
    setBoardLoading(true)
    setPageError('')
    setBoard(null)
    api.board(token, boardId)
      .then(detail => { if (!cancelled) setBoard(detail) })
      .catch(error => { if (!cancelled) handleApiError(error) })
      .finally(() => { if (!cancelled) setBoardLoading(false) })
    return () => { cancelled = true }
  }, [token, boardId, reloadKey, handleApiError])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') setModal(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const allCards = useMemo(() => board?.colunas.flatMap(column => column.cards) ?? [], [board])
  const filteredColumns = useMemo(() => board?.colunas.map(column => ({
    ...column,
    cards: column.cards.filter(card => {
      const matchesText = `${card.titulo} ${card.processo.titulo} ${card.processo.numeroProcesso ?? ''} ${card.processo.cliente.nome} ${card.processo.area}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))
      return matchesText && (areaFilter === 'TODAS' || card.processo.area === areaFilter)
    }),
  })) ?? [], [board, query, areaFilter])
  const upcomingAppointments = allCards.filter(card => {
    const date = card.processo.proximoAgendamento?.dataHora
    return date ? new Date(date).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 : false
  }).length
  const completedCount = board?.colunas.filter(column => column.status === 'CONCLUIDO').reduce((count, column) => count + column.cards.length, 0) ?? 0
  const availableClients = clients.filter(client => client.ativo)

  const refresh = () => setReloadKey(value => value + 1)

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const result = await api.login(email.trim(), password)
      sessionStorage.setItem(API_TOKEN_KEY, result.token)
      setToken(result.token)
      setPassword('')
    } catch (error) {
      setLoginError(errorMessage(error))
    } finally {
      setLoginLoading(false)
    }
  }

  const createBoard = async () => {
    if (!token) return
    setSaving(true)
    setPageError('')
    try {
      const created = await api.createBoard(token, 'Processos')
      setBoards(current => [...current, { id: created.id, nome: 'Processos', totalColunas: 6, totalCards: 0 }])
      setBoardId(created.id)
    } catch (error) { handleApiError(error) }
    finally { setSaving(false) }
  }

  const moveCard = async (cardId: string, targetColumnId: string) => {
    if (!token || !board || busyCard) return
    const source = board.colunas.flatMap(column => column.cards).find(card => card.id === cardId)
    if (!source || source.colunaId === targetColumnId) return
    const target = board.colunas.find(column => column.id === targetColumnId)
    if (!target) return
    setBusyCard(cardId)
    setPageError('')
    try {
      await api.moveCard(token, board.id, cardId, targetColumnId, target.cards.length)
      setBoard(await api.board(token, board.id))
      setNotice(`Processo movido para ${target.nome}`)
    } catch (error) { handleApiError(error) }
    finally { setBusyCard(null); setDragging(null) }
  }

  const submitProcess = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !board || !clientId || !processTitle.trim()) return
    setSaving(true)
    setPageError('')
    try {
      const created = await api.createProcess(token, { clienteId: clientId, titulo: processTitle.trim(), area })
      try {
        await api.addCard(token, board.id, created.id)
      } catch (error) {
        throw new Error(`O processo foi cadastrado, mas não entrou no quadro: ${errorMessage(error)}`)
      }
      const detail = await api.board(token, board.id)
      setBoard(detail)
      setModal(false)
      setProcessTitle('')
      setClientId('')
      setNotice('Processo cadastrado e adicionado ao quadro')
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleApiError(error); else setPageError(errorMessage(error)) }
    finally { setSaving(false) }
  }

  if (!token) return <LoginScreen email={email} password={password} loading={loginLoading} error={loginError} setEmail={setEmail} setPassword={setPassword} onSubmit={submitLogin} />
  if (workspaceLoading && !profile) return <div className="loading-screen"><LoaderCircle className="spin" size={25}/><span>Conectando ao ADLO...</span></div>

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#kanban" aria-label="ADLO, início"><span className="brand-mark"><Gavel size={20} strokeWidth={2.2}/></span><span>adlo<span className="brand-dot">.</span></span></a>
      <div className="workspace"><div className="workspace-icon">{(profile?.nome ?? 'A').trim().charAt(0).toUpperCase()}</div><div className="workspace-copy"><strong>{profile?.nome ?? 'Meu escritório'}</strong><span>{profile?.papel === 'ADVOGADO' ? 'Advogado' : profile?.papel === 'ESTAGIARIO' ? 'Estagiário' : 'Administrativo'}</span></div><ChevronDown size={15} className="muted"/></div>
      <div className="nav-label">ESCRITÓRIO</div>
      <nav className="side-nav" aria-label="Navegação principal">
        <a className="nav-item active" href="#kanban" aria-current="page"><LayoutGrid size={18}/><span>Processos</span><span className="nav-count">{boards.reduce((sum, item) => sum + item.totalCards, 0)}</span></a>
        <span className="nav-item unavailable" aria-disabled="true" title="Disponível em breve"><Users size={18}/><span>Clientes</span><span className="soon">Em breve</span></span>
        <span className="nav-item unavailable" aria-disabled="true" title="Disponível em breve"><CalendarDays size={18}/><span>Agendamento</span><span className="soon">Em breve</span></span>
      </nav>
      <div className="sidebar-bottom"><button className="nav-item nav-logout" onClick={()=>setNotice('Peça ajuda ao responsável pelo escritório.')}><CircleHelp size={18}/><span>Central de ajuda</span></button><button className="nav-item nav-logout" onClick={logout}><LogOut size={18}/><span>Sair da conta</span></button><div className="profile"><div className="avatar avatar-profile">{initials(profile?.nome ?? '')}</div><div className="profile-copy"><strong>{profile?.nome}</strong><span>{profile?.email}</span></div><MoreHorizontal size={19} className="muted"/></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Fechar navegação" onClick={() => setMobileNav(false)}/>}
    <main className="main-area" id="kanban">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Abrir navegação" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumbs"><span>Escritório</span><ChevronRight size={14}/><strong>Processos</strong></div><div className="top-actions"><span className="today-label">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date())}</span><button className="icon-button notification" aria-label="Atualizar quadro" onClick={refresh}><RefreshCw size={17}/></button><button className="avatar avatar-profile top-avatar" aria-label={`Conta de ${profile?.nome ?? ''}`} onClick={logout}>{initials(profile?.nome ?? '')}</button></div></header>
      <section className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> QUADRO DO ESCRITÓRIO</div><h1>{board?.nome ?? 'Processos'}</h1><p className="subtitle">Acompanhe os processos cadastrados no ADLO.</p></div>{boards.length > 1 && <label className="board-picker"><span>Quadro</span><select aria-label="Selecionar quadro" value={boardId} onChange={event => setBoardId(event.target.value)}>{boards.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>}{board && <button className="primary-button" onClick={() => {setProcessTitle('');setClientId(availableClients[0]?.id ?? '');setModal(true)}} disabled={saving}><Plus size={17} strokeWidth={2.3}/> Novo processo</button>}</div>
        {pageError && <div className="page-error" role="alert"><span>{pageError}</span><button className="secondary-button" onClick={refresh}>Tentar novamente</button></div>}
        {!pageError && board && <div className="summary-row"><SummaryCard icon={<BriefcaseBusiness size={17}/>} tone="total-icon" label="Processos neste quadro" value={String(allCards.length).padStart(2, '0')} detail={`${board.colunas.length} etapas`}/><SummaryCard icon={<Clock3 size={17}/>} tone="deadline-icon" label="Agendamentos nos próximos 7 dias" value={String(upcomingAppointments).padStart(2, '0')} detail="no quadro"/><SummaryCard icon={<Check size={17}/>} tone="done-icon" label="Na etapa concluído" value={String(completedCount).padStart(2, '0')} detail="neste quadro"/></div>}
        {!pageError && boards.length>0 && <section className="board-section" aria-label="Quadro de processos"><div className="board-toolbar"><div className="board-heading"><span className="board-live-dot"/>Dados atualizados do escritório<span className="board-card-total">{allCards.length} processos</span></div><div className="toolbar-actions"><label className="search-box"><Search size={16}/><input ref={searchRef} aria-label="Buscar processos" placeholder="Buscar processo ou cliente..." value={query} onChange={event => setQuery(event.target.value)}/><kbd>⌘ K</kbd></label><label className="area-select"><SlidersHorizontal size={15}/><select aria-label="Filtrar por área" value={areaFilter} onChange={event => setAreaFilter(event.target.value as typeof areaFilter)}><option value="TODAS">Todas as áreas</option><option value="INSS">INSS</option><option value="DPVAT">DPVAT</option></select></label><button className="icon-button sort-button" aria-label="Atualizar quadro" onClick={refresh}><RefreshCw size={17}/></button></div></div>
          {boardLoading ? <div className="board-loading"><LoaderCircle size={21} className="spin"/><span>Carregando processos...</span></div> : !board ? <div className="board-loading"><LoaderCircle size={21} className="spin"/><span>Carregando quadro...</span></div> : <><div className="board-scroll"><div className="board-grid" style={{gridTemplateColumns:`repeat(${Math.max(filteredColumns.length,1)}, 238px)`}}>{filteredColumns.map((column, index) => <section className="kanban-column" key={column.id} aria-label={`${column.nome}, ${column.cards.length} processos`} onDragOver={event => event.preventDefault()} onDrop={event => {event.preventDefault();if(dragging)void moveCard(dragging,column.id)}}><header className="column-header"><div className="column-title"><i style={{background:columnColors[index % columnColors.length]}}/><h2>{column.nome}</h2><span className="column-count">{column.cards.length}</span></div><button className="column-menu" aria-label={`Opções da coluna ${column.nome}`} onClick={() => setNotice(`${column.cards.length} processos nesta etapa`)}><MoreHorizontal size={18}/></button></header><div className="column-cards">{column.cards.map(card => { const appointment=card.processo.proximoAgendamento; const days=appointment ? daysUntil(appointment.dataHora) : null; return <article className={`process-card ${dragging===card.id?'is-dragging':''} ${busyCard===card.id?'is-busy':''}`} key={card.id} draggable={!busyCard} onDragStart={event=>{setDragging(card.id);event.dataTransfer.setData('text/plain',card.id)}} onDragEnd={()=>setDragging(null)}><div className="card-top"><span className="area-tag">{card.processo.area}</span><button className="card-menu" aria-label={`Detalhes do processo de ${card.processo.cliente.nome}`} onClick={()=>setNotice(card.processo.numeroProcesso ? `Processo ${card.processo.numeroProcesso}` : card.processo.titulo)}><MoreHorizontal size={17}/></button></div><h3>{card.titulo || card.processo.titulo}</h3><div className="client-row"><div className={`avatar avatar-tone-${index % 6}`}>{initials(card.processo.cliente.nome)}</div><span>{card.processo.cliente.nome}</span></div><div className="process-number"><FileText size={13}/><span>{card.processo.numeroProcesso || 'Número não informado'}</span></div>{appointment && <div className={`due-chip ${days !== null && days <= 1 ? 'soon' : ''}`}><Clock3 size={12}/><span>{appointment.titulo || appointment.tipo} · {appointmentLabel(appointment.dataHora)}</span></div>}<footer className="card-footer"><div className="owner"><span className="status-caption">{column.nome}</span></div><button className="move-card" disabled={busyCard===card.id || index===filteredColumns.length-1} title="Mover para próxima etapa" aria-label={`Mover ${card.processo.cliente.nome} para próxima etapa`} onClick={()=>{const next=filteredColumns[index+1];if(next)void moveCard(card.id,next.id)}}>{busyCard===card.id?<LoaderCircle className="spin" size={15}/>:<ChevronRight size={15}/>}</button></footer></article>})}{column.cards.length===0 && <div className="column-empty">{query || areaFilter!=='TODAS' ? 'Nenhum resultado' : 'Nenhum processo nesta etapa'}</div>}</div></section>)}</div></div><div className="board-footer"><span>Exibindo <strong>{filteredColumns.reduce((count,column)=>count+column.cards.length,0)}</strong> de {allCards.length} processos</span><button className="refresh-link" onClick={refresh}><RefreshCw size={13}/> Atualizar dados</button></div></>}
        </section>}
        {!pageError && !workspaceLoading && boards.length===0 && <div className="empty-board"><div className="empty-board-icon"><LayoutGrid size={23}/></div><h2>Seu primeiro quadro começa aqui</h2><p>O ADLO ainda não tem um quadro para sua conta. Crie o quadro com as etapas padrão e comece a acompanhar processos reais.</p><button className="primary-button" onClick={createBoard} disabled={saving}>{saving?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>} Criar quadro de processos</button></div>}
        {!pageError && !workspaceLoading && board && allCards.length===0 && <div className="empty-board compact-empty"><div className="empty-board-icon"><BriefcaseBusiness size={22}/></div><h2>O quadro ainda está vazio</h2><p>Cadastre um processo vinculado a um cliente ativo para adicioná-lo a este quadro.</p><button className="primary-button" onClick={()=>{setProcessTitle('');setClientId(availableClients[0]?.id??'');setModal(true)}} disabled={!availableClients.length}><Plus size={16}/> Novo processo</button>{!availableClients.length&&<span className="empty-hint">Cadastre um cliente antes de criar o processo.</span>}</div>}
      </section>
    </main>
    {modal && board && <div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)setModal(false)}}><form className="process-modal" onSubmit={submitProcess} aria-labelledby="modal-title"><header><div><span className="modal-kicker">CADASTRO NO ADLO</span><h2 id="modal-title">Novo processo</h2><p>O processo será salvo e vinculado ao quadro.</p></div><button type="button" className="icon-button" aria-label="Fechar" onClick={()=>setModal(false)} disabled={saving}><X size={18}/></button></header><label>Nome do processo<input autoFocus value={processTitle} onChange={event=>setProcessTitle(event.target.value)} placeholder="Ex.: Revisão de benefício" maxLength={200} required/></label><label>Cliente<select value={clientId} onChange={event=>setClientId(event.target.value)} required disabled={!availableClients.length}><option value="" disabled>Selecione um cliente</option>{availableClients.map(client=><option key={client.id} value={client.id}>{client.nome}</option>)}</select></label><label>Área<select value={area} onChange={event=>setArea(event.target.value as typeof area)}><option value="INSS">INSS</option><option value="DPVAT">DPVAT</option></select></label>{!availableClients.length&&<div className="inline-error">Nenhum cliente ativo encontrado. Cadastre um cliente pela API e tente novamente.</div>}<div className="modal-note"><span className="column-dot"/> A etapa inicial será definida pelo status do processo.</div><footer><button type="button" className="secondary-button" onClick={()=>setModal(false)} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving||!availableClients.length}>{saving?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>} Criar processo</button></footer></form></div>}
    {notice && <div className="toast" role="status"><Check size={16}/>{notice}<button aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={15}/></button></div>}
  </div>
}

function LoginScreen({ email, password, loading, error, setEmail, setPassword, onSubmit }: { email: string; password: string; loading: boolean; error: string; setEmail: (value:string)=>void; setPassword: (value:string)=>void; onSubmit: (event:FormEvent)=>void }) {
  return <main className="login-screen"><section className="login-card"><a className="brand login-brand" href="#login"><span className="brand-mark"><Gavel size={20}/></span><span>adlo<span className="brand-dot">.</span></span></a><div className="login-eyebrow">GESTÃO JURÍDICA</div><h1>Acesse seu escritório</h1><p>Entre com suas credenciais do ADLO para ver os processos cadastrados.</p><form onSubmit={onSubmit}><label>E-mail<input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} placeholder="voce@escritorio.com.br" required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Sua senha" required/></label>{error&&<div className="inline-error" role="alert">{error}</div>}<button className="primary-button login-submit" type="submit" disabled={loading}>{loading?<LoaderCircle size={17} className="spin"/>:'Entrar no ADLO'}</button></form><div className="login-api-note">API configurada em <code>{apiUrl}</code></div></section></main>
}

function SummaryCard({icon,tone,label,value,detail}:{icon:ReactNode;tone:string;label:string;value:string;detail:string}) {
  return <div className="summary-card"><div className={`summary-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value} <small>{detail}</small></strong></div></div>
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toLocaleUpperCase('pt-BR')??'').join('') || '?'
}

function daysUntil(dateString: string) {
  return Math.ceil((new Date(dateString).getTime()-Date.now())/(24*60*60*1000))
}

function appointmentLabel(dateString: string) {
  const date=new Date(dateString)
  if(Number.isNaN(date.getTime())) return 'Data não informada'
  const days=daysUntil(dateString)
  if(days<=0) return 'Hoje'
  if(days===1) return 'Amanhã'
  if(days<7) return `Em ${days} dias`
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(date)
}

export default App

