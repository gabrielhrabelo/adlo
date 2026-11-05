import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, apiUrl, ApiError, type BoardDetail, type BoardSummary, type ClienteResumo, type ProcessoListItem, type UserProfile } from './api'
import { BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, FileText, LayoutGrid, LoaderCircle, LogOut, Menu, MoreHorizontal, Plus, RefreshCw, Search, SlidersHorizontal, Users, X, PanelLeftClose, PanelLeftOpen, GripVertical } from 'lucide-react'

const API_TOKEN_KEY = 'adlo.accessToken'
const columnColors = ['#6b7280', '#4b5563', '#9ca3af', '#374151', '#737373', '#525252', '#a3a3a3']

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
  const [processes, setProcesses] = useState<ProcessoListItem[]>([])
  const [page, setPage] = useState<'kanban' | 'processes' | 'clients'>('kanban')
  const [listQuery, setListQuery] = useState('')
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
  const [modal, setModal] = useState<'process' | 'client' | null>(null)
  const [processTitle, setProcessTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [area, setArea] = useState<'INSS' | 'DPVAT'>('INSS')
  const [mobileNav, setMobileNav] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(252)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [processNumber, setProcessNumber] = useState('')
  const [processDate, setProcessDate] = useState(new Date().toISOString().slice(0, 10))
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
        const [clientPage, processPage] = await Promise.all([api.allClients(token, user.id), api.processes(token)])
        if (cancelled) return
        setProfile(user)
        setBoards(boardList)
        setClients(clientPage.items)
        setProcesses(processPage.items)
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
      if (event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') setModal(null)
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
    if (!token || !clientId || !processTitle.trim()) return
    setSaving(true)
    setPageError('')
    try {
      const created = await api.createProcess(token, { clienteId: clientId, titulo: processTitle.trim(), area, numeroProcesso: processNumber.trim() || null, dataAbertura: processDate })
      let boardWarning = ''
      if (board) {
        try { await api.addCard(token, board.id, created.id) }
        catch (error) { boardWarning = `Processo cadastrado, mas não entrou no quadro: ${errorMessage(error)}` }
        if (!boardWarning) setBoard(await api.board(token, board.id))
      }
      setProcesses(await api.processes(token).then(result => result.items))
      setModal(null)
      setProcessTitle('')
      setClientId('')
      setProcessNumber('')
      setNotice(boardWarning || (board ? 'Processo cadastrado e adicionado ao quadro' : 'Processo cadastrado com sucesso'))
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleApiError(error); else setPageError(errorMessage(error)) }
    finally { setSaving(false) }
  }

  const submitClient = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !clientName.trim()) return
    setSaving(true)
    setPageError('')
    try {
      const created = await api.createClient(token, { nome: clientName.trim(), email: clientEmail.trim() || null, telefones: clientPhone.trim() ? [{ numero: clientPhone.trim() }] : [] })
      setClients(current => [...current, created].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
      setClientName(''); setClientEmail(''); setClientPhone(''); setModal(null)
      setNotice('Cliente cadastrado com sucesso')
    } catch (error) { handleApiError(error) }
    finally { setSaving(false) }
  }

  if (!token) return <LoginScreen email={email} password={password} loading={loginLoading} error={loginError} setEmail={setEmail} setPassword={setPassword} onSubmit={submitLogin} />
  if (workspaceLoading && !profile) return <div className="loading-screen"><LoaderCircle className="spin" size={25}/><span>Conectando ao ADLO...</span></div>

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} style={{width:sidebarCollapsed?72:sidebarWidth}}>
      <div className="sidebar-header"><a className="brand" href="#kanban" aria-label="ADLO, início"><span>adlo<span className="brand-dot">.</span></span></a><button className="sidebar-toggle" aria-label={sidebarCollapsed?'Expandir menu lateral':'Recolher menu lateral'} title={sidebarCollapsed?'Expandir menu':'Recolher menu'} onClick={()=>setSidebarCollapsed(value=>!value)}>{sidebarCollapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button></div>
      <div className="workspace"><div className="workspace-copy"><strong>{profile?.nome ?? 'Meu escritório'}</strong><span>{profile?.papel === 'ADVOGADO' ? 'Advogado' : profile?.papel === 'ESTAGIARIO' ? 'Estagiário' : 'Administrativo'}</span></div><ChevronDown size={15} className="muted"/></div>
      <div className="nav-label">ESCRITÓRIO</div>
      <nav className="side-nav" aria-label="Navegação principal">
        <button className={`nav-item ${page==='kanban'?'active':''}`} aria-current={page==='kanban'?'page':undefined} onClick={()=>{setPage('kanban');setMobileNav(false)}}><LayoutGrid size={18}/><span>Quadro</span></button>
        <button className={`nav-item ${page==='processes'?'active':''}`} aria-current={page==='processes'?'page':undefined} onClick={()=>{setPage('processes');setMobileNav(false)}}><BriefcaseBusiness size={18}/><span>Processos</span></button>
        <button className={`nav-item ${page==='clients'?'active':''}`} aria-current={page==='clients'?'page':undefined} onClick={()=>{setPage('clients');setMobileNav(false)}}><Users size={18}/><span>Clientes</span></button>
        <span className="nav-item unavailable" aria-disabled="true"><CalendarDays size={18}/><span>Agendamento</span></span>
      </nav>
      <div className="sidebar-bottom"><button className="nav-item nav-logout" onClick={()=>setNotice('Peça ajuda ao responsável pelo escritório.')}><CircleHelp size={18}/><span>Central de ajuda</span></button><button className="nav-item nav-logout" onClick={logout}><LogOut size={18}/><span>Sair da conta</span></button><div className="profile"><div className="avatar avatar-profile">{initials(profile?.nome ?? '')}</div><div className="profile-copy"><strong>{profile?.nome}</strong><span>{profile?.email}</span></div></div></div>
      {!sidebarCollapsed && <button className="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Redimensionar menu lateral" title="Arraste para redimensionar" onKeyDown={event=>{if(event.key==='ArrowLeft')setSidebarWidth(value=>Math.max(220,value-12));if(event.key==='ArrowRight')setSidebarWidth(value=>Math.min(340,value+12))}} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);const startX=event.clientX;const startWidth=sidebarWidth;const move=(e:PointerEvent)=>setSidebarWidth(Math.max(220,Math.min(340,startWidth+e.clientX-startX)));const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop,{once:true})}}><GripVertical size={14}/></button>}
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Fechar navegação" onClick={() => setMobileNav(false)}/>}
    <button className="icon-button mobile-menu mobile-menu-floating" aria-label="Abrir navegação" onClick={() => setMobileNav(true)}><Menu size={20}/></button>
    <main className="main-area" id="kanban" style={{marginLeft:sidebarCollapsed?72:sidebarWidth}}>
      <section className="page-content">
        {pageError && page!=='kanban' && <div className="page-error" role="alert"><span>{pageError}</span><button className="secondary-button" onClick={refresh}>Tentar novamente</button></div>}
        {page === 'clients' ? <>
          <div className="page-heading"><div><div className="eyebrow">ESCRITÓRIO</div><h1>Clientes</h1><p className="subtitle">Cadastro e contatos dos clientes do escritório.</p></div><button className="primary-button" onClick={()=>{setClientName('');setClientEmail('');setClientPhone('');setModal('client')}}><Plus size={17}/> Novo cliente</button></div>
          <div className="list-panel"><div className="list-toolbar"><label className="search-box"><Search size={16}/><input aria-label="Buscar clientes" placeholder="Buscar por nome ou e-mail" value={listQuery} onChange={event=>setListQuery(event.target.value)}/></label><span>{clients.filter(c=>`${c.nome} ${c.email??''}`.toLocaleLowerCase('pt-BR').includes(listQuery.toLocaleLowerCase('pt-BR'))).length} clientes</span></div><div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>CPF / CNPJ</th><th>CONTATO</th><th>PROCESSOS</th><th>SITUAÇÃO</th></tr></thead><tbody>{clients.filter(c=>`${c.nome} ${c.email??''} ${c.cpfCnpj??''}`.toLocaleLowerCase('pt-BR').includes(listQuery.toLocaleLowerCase('pt-BR'))).map(c=><tr key={c.id}><td><div className="table-person"><span className="table-avatar">{initials(c.nome)}</span><strong>{c.nome}</strong></div></td><td>{c.cpfCnpj||'—'}</td><td>{c.email||c.telefonePrincipal||'—'}</td><td>{c.totalProcessos??0}</td><td><span className={`status-pill ${c.ativo?'':'inactive'}`}>{c.ativo?'Ativo':'Inativo'}</span></td></tr>)}{clients.length===0&&<tr><td colSpan={5} className="table-empty">Nenhum cliente cadastrado ainda.</td></tr>}</tbody></table></div></div>
        </> : page === 'processes' ? <>
          <div className="page-heading"><div><div className="eyebrow">ESCRITÓRIO</div><h1>Processos</h1><p className="subtitle">Consulte e cadastre os processos do escritório.</p></div><button className="primary-button" onClick={()=>{setProcessTitle('');setProcessNumber('');setClientId(availableClients[0]?.id??'');setModal('process')}}><Plus size={17}/> Novo processo</button></div>
          <div className="list-panel"><div className="list-toolbar"><label className="search-box"><Search size={16}/><input aria-label="Buscar processos" ref={searchRef} placeholder="Buscar por processo ou cliente" value={listQuery} onChange={event=>setListQuery(event.target.value)}/></label><span>{processes.filter(p=>`${p.titulo} ${p.numeroProcesso??''} ${p.cliente.nome}`.toLocaleLowerCase('pt-BR').includes(listQuery.toLocaleLowerCase('pt-BR'))).length} processos</span></div><div className="table-scroll"><table><thead><tr><th>PROCESSO</th><th>CLIENTE</th><th>ÁREA</th><th>ABERTURA</th><th>STATUS</th></tr></thead><tbody>{processes.filter(p=>`${p.titulo} ${p.numeroProcesso??''} ${p.cliente.nome}`.toLocaleLowerCase('pt-BR').includes(listQuery.toLocaleLowerCase('pt-BR'))).map(p=><tr key={p.id}><td><strong>{p.titulo}</strong><small>{p.numeroProcesso||'Número não informado'}</small></td><td>{p.cliente.nome}</td><td>{p.area}</td><td>{p.dataAbertura?new Intl.DateTimeFormat('pt-BR').format(new Date(`${p.dataAbertura}T00:00:00`)):'—'}</td><td><span className="status-pill">{p.status}</span></td></tr>)}{processes.length===0&&<tr><td colSpan={5} className="table-empty">Nenhum processo cadastrado ainda.</td></tr>}</tbody></table></div></div>
        </> : <>
        <div className="page-heading"><div><h1>{board?.nome ?? 'Processos'}</h1><p className="subtitle">Acompanhe os processos cadastrados no ADLO.</p></div>{boards.length > 1 && <label className="board-picker"><span>Quadro</span><select aria-label="Selecionar quadro" value={boardId} onChange={event => setBoardId(event.target.value)}>{boards.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>}{board && <button className="primary-button" onClick={() => {setProcessTitle('');setProcessNumber('');setClientId(availableClients[0]?.id ?? '');setModal('process')}} disabled={saving}><Plus size={17} strokeWidth={2.3}/> Novo processo</button>}</div>
        {pageError && <div className="page-error" role="alert"><span>{pageError}</span><button className="secondary-button" onClick={refresh}>Tentar novamente</button></div>}
        {!pageError && board && <div className="summary-row"><SummaryCard icon={<BriefcaseBusiness size={17}/>} tone="total-icon" label="Processos neste quadro" value={String(allCards.length).padStart(2, '0')} detail={`${board.colunas.length} etapas`}/><SummaryCard icon={<Clock3 size={17}/>} tone="deadline-icon" label="Agendamentos nos próximos 7 dias" value={String(upcomingAppointments).padStart(2, '0')} detail="no quadro"/><SummaryCard icon={<Check size={17}/>} tone="done-icon" label="Na etapa concluído" value={String(completedCount).padStart(2, '0')} detail="neste quadro"/></div>}
        {!pageError && boards.length>0 && <section className="board-section" aria-label="Quadro de processos"><div className="board-toolbar"><div className="board-heading"><span className="board-live-dot"/>Dados atualizados do escritório<span className="board-card-total">{allCards.length} processos</span></div><div className="toolbar-actions"><label className="search-box"><Search size={16}/><input ref={searchRef} aria-label="Buscar processos" placeholder="Buscar processo ou cliente..." value={query} onChange={event => setQuery(event.target.value)}/><kbd>Ctrl K</kbd></label><label className="area-select"><SlidersHorizontal size={15}/><select aria-label="Filtrar por área" value={areaFilter} onChange={event => setAreaFilter(event.target.value as typeof areaFilter)}><option value="TODAS">Todas as áreas</option><option value="INSS">INSS</option><option value="DPVAT">DPVAT</option></select></label><button className="icon-button sort-button" aria-label="Atualizar quadro" onClick={refresh}><RefreshCw size={17}/></button></div></div>
          {boardLoading ? <div className="board-loading"><LoaderCircle size={21} className="spin"/><span>Carregando processos...</span></div> : !board ? <div className="board-loading"><LoaderCircle size={21} className="spin"/><span>Carregando quadro...</span></div> : <><div className="board-scroll"><div className="board-grid" style={{gridTemplateColumns:`repeat(${Math.max(filteredColumns.length,1)}, 238px)`}}>{filteredColumns.map((column, index) => <section className="kanban-column" key={column.id} aria-label={`${column.nome}, ${column.cards.length} processos`} onDragOver={event => event.preventDefault()} onDrop={event => {event.preventDefault();if(dragging)void moveCard(dragging,column.id)}}><header className="column-header"><div className="column-title"><i style={{background:columnColors[index % columnColors.length]}}/><h2>{column.nome}</h2><span className="column-count">{column.cards.length}</span></div><button className="column-menu" aria-label={`Opções da coluna ${column.nome}`} onClick={() => setNotice(`${column.cards.length} processos nesta etapa`)}><MoreHorizontal size={18}/></button></header><div className="column-cards">{column.cards.map(card => { const appointment=card.processo.proximoAgendamento; const days=appointment ? daysUntil(appointment.dataHora) : null; return <article className={`process-card ${dragging===card.id?'is-dragging':''} ${busyCard===card.id?'is-busy':''}`} key={card.id} draggable={!busyCard} onDragStart={event=>{setDragging(card.id);event.dataTransfer.setData('text/plain',card.id)}} onDragEnd={()=>setDragging(null)}><div className="card-top"><span className="area-tag">{card.processo.area}</span><button className="card-menu" aria-label={`Detalhes do processo de ${card.processo.cliente.nome}`} onClick={()=>setNotice(card.processo.numeroProcesso ? `Processo ${card.processo.numeroProcesso}` : card.processo.titulo)}><MoreHorizontal size={17}/></button></div><h3>{card.titulo || card.processo.titulo}</h3><div className="client-row"><div className={`avatar avatar-tone-${index % 6}`}>{initials(card.processo.cliente.nome)}</div><span>{card.processo.cliente.nome}</span></div><div className="process-number"><FileText size={13}/><span>{card.processo.numeroProcesso || 'Número não informado'}</span></div>{appointment && <div className={`due-chip ${days !== null && days <= 1 ? 'soon' : ''}`}><Clock3 size={12}/><span>{appointment.titulo || appointment.tipo} · {appointmentLabel(appointment.dataHora)}</span></div>}<footer className="card-footer"><div className="owner"><span className="status-caption">{column.nome}</span></div><button className="move-card" disabled={busyCard===card.id || index===filteredColumns.length-1} title="Mover para próxima etapa" aria-label={`Mover ${card.processo.cliente.nome} para próxima etapa`} onClick={()=>{const next=filteredColumns[index+1];if(next)void moveCard(card.id,next.id)}}>{busyCard===card.id?<LoaderCircle className="spin" size={15}/>:<ChevronRight size={15}/>}</button></footer></article>})}{column.cards.length===0 && <div className="column-empty">{query || areaFilter!=='TODAS' ? 'Nenhum resultado' : 'Nenhum processo nesta etapa'}</div>}</div></section>)}</div></div><div className="board-footer"><span>Exibindo <strong>{filteredColumns.reduce((count,column)=>count+column.cards.length,0)}</strong> de {allCards.length} processos</span><button className="refresh-link" onClick={refresh}><RefreshCw size={13}/> Atualizar dados</button></div></>}
        </section>}
        {!pageError && !workspaceLoading && boards.length===0 && <div className="empty-board"><div className="empty-board-icon"><LayoutGrid size={23}/></div><h2>Seu primeiro quadro começa aqui</h2><p>O ADLO ainda não tem um quadro para sua conta. Crie o quadro com as etapas padrão e comece a acompanhar processos reais.</p><button className="primary-button" onClick={createBoard} disabled={saving}>{saving?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>} Criar quadro de processos</button></div>}
        {!pageError && !workspaceLoading && board && allCards.length===0 && <div className="empty-board compact-empty"><div className="empty-board-icon"><BriefcaseBusiness size={22}/></div><h2>O quadro ainda está vazio</h2><p>Cadastre um processo vinculado a um cliente ativo para adicioná-lo a este quadro.</p><button className="primary-button" onClick={()=>{setProcessTitle('');setClientId(availableClients[0]?.id??'');setModal('process')}} disabled={!availableClients.length}><Plus size={16}/> Novo processo</button>{!availableClients.length&&<span className="empty-hint">Cadastre um cliente antes de criar o processo.</span>}</div>}
      </>}
      </section>
    </main>
    {modal === 'process' && <div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)setModal(null)}}><form className="process-modal" onSubmit={submitProcess} aria-labelledby="modal-title"><header><div><span className="modal-kicker">CADASTRO NO ADLO</span><h2 id="modal-title">Novo processo</h2><p>{board?'O processo será salvo e vinculado ao quadro.':'Preencha os dados principais do processo.'}</p></div><button type="button" className="icon-button" aria-label="Fechar" onClick={()=>setModal(null)} disabled={saving}><X size={18}/></button></header><label>Nome do processo<input autoFocus value={processTitle} onChange={event=>setProcessTitle(event.target.value)} placeholder="Ex.: Revisão de benefício" maxLength={200} required/></label><label>Número do processo<input value={processNumber} onChange={event=>setProcessNumber(event.target.value)} placeholder="Opcional" maxLength={25}/></label><label>Cliente<select value={clientId} onChange={event=>setClientId(event.target.value)} required disabled={!availableClients.length}><option value="" disabled>Selecione um cliente</option>{availableClients.map(client=><option key={client.id} value={client.id}>{client.nome}</option>)}</select></label><label>Área<select value={area} onChange={event=>setArea(event.target.value as typeof area)}><option value="INSS">INSS</option><option value="DPVAT">DPVAT</option></select></label><label>Data de abertura<input type="date" value={processDate} onChange={event=>setProcessDate(event.target.value)} required/></label>{!availableClients.length&&<div className="inline-error">Cadastre um cliente ativo antes de criar o processo.</div>}<footer><button type="button" className="secondary-button" onClick={()=>setModal(null)} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving||!availableClients.length}>{saving?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>} Criar processo</button></footer></form></div>}
    {modal === 'client' && <div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)setModal(null)}}><form className="process-modal" onSubmit={submitClient} aria-labelledby="client-modal-title"><header><div><span className="modal-kicker">CADASTRO NO ADLO</span><h2 id="client-modal-title">Novo cliente</h2><p>Os campos opcionais podem ser preenchidos depois.</p></div><button type="button" className="icon-button" aria-label="Fechar" onClick={()=>setModal(null)} disabled={saving}><X size={18}/></button></header><label>Nome completo<input autoFocus value={clientName} onChange={event=>setClientName(event.target.value)} placeholder="Nome do cliente" maxLength={160} minLength={2} required/></label><label>E-mail<input type="email" value={clientEmail} onChange={event=>setClientEmail(event.target.value)} placeholder="cliente@email.com" maxLength={254}/></label><label>Telefone<input type="tel" value={clientPhone} onChange={event=>setClientPhone(event.target.value)} placeholder="(11) 99999-9999" minLength={clientPhone?8:undefined}/></label><footer><button type="button" className="secondary-button" onClick={()=>setModal(null)} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving||clientName.trim().length<2}>{saving?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>} Cadastrar cliente</button></footer></form></div>}    {notice && <div className="toast" role="status"><Check size={16}/>{notice}<button aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={15}/></button></div>}
  </div>
}

function LoginScreen({ email, password, loading, error, setEmail, setPassword, onSubmit }: { email: string; password: string; loading: boolean; error: string; setEmail: (value:string)=>void; setPassword: (value:string)=>void; onSubmit: (event:FormEvent)=>void }) {
  return <main className="login-screen"><section className="login-card"><a className="brand login-brand" href="#login"><span>adlo<span className="brand-dot">.</span></span></a><div className="login-eyebrow">GESTÃO JURÍDICA</div><h1>Acesse seu escritório</h1><p>Entre com suas credenciais do ADLO para ver os processos cadastrados.</p><form onSubmit={onSubmit}><label>E-mail<input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} placeholder="voce@escritorio.com.br" required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Sua senha" required/></label>{error&&<div className="inline-error" role="alert">{error}</div>}<button className="primary-button login-submit" type="submit" disabled={loading}>{loading?<LoaderCircle size={17} className="spin"/>:'Entrar no ADLO'}</button></form><div className="login-api-note">API configurada em <code>{apiUrl}</code></div></section></main>
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

