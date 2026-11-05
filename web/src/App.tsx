import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowDownUp, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, FileText, Gavel, LayoutGrid, Menu, MoreHorizontal, Plus, Search, Settings2, SlidersHorizontal, Users, X } from 'lucide-react'

type Status = 'TRIAGEM' | 'DOCUMENTACAO' | 'PROTOCOLO' | 'EM_ANDAMENTO' | 'AGUARDANDO' | 'CONCLUIDO'
type Process = { id: string; title: string; client: string; area: string; number: string; status: Status; due?: string; dueTone?: string; initials: string; color: string; owner: string }
const columns: { id: Status; label: string; color: string; tint: string }[] = [
  { id: 'TRIAGEM', label: 'Triagem', color: '#7c8798', tint: '#eef0f3' },
  { id: 'DOCUMENTACAO', label: 'Documentação', color: '#d99535', tint: '#fff4df' },
  { id: 'PROTOCOLO', label: 'Protocolo', color: '#8172d5', tint: '#f0edff' },
  { id: 'EM_ANDAMENTO', label: 'Em andamento', color: '#4276d5', tint: '#eaf1ff' },
  { id: 'AGUARDANDO', label: 'Aguardando', color: '#ce7957', tint: '#fff0e9' },
  { id: 'CONCLUIDO', label: 'Concluído', color: '#3d9b77', tint: '#e7f5ef' },
]
const initial: Process[] = [
  { id: '01', title: 'Concessão de benefício previdenciário', client: 'Mariana Costa Ferreira', area: 'INSS', number: '5002847-16.2025.4.03.6100', status: 'TRIAGEM', due: 'Hoje', dueTone: 'urgent', initials: 'MC', color: 'rose', owner: 'Ana Lima' },
  { id: '02', title: 'Revisão de aposentadoria por tempo', client: 'Roberto Almeida Santos', area: 'INSS', number: '5001932-48.2025.4.03.6100', status: 'TRIAGEM', due: 'Em 3 dias', initials: 'RS', color: 'blue', owner: 'Lucas Prado' },
  { id: '03', title: 'Auxílio por incapacidade temporária', client: 'Camila Nogueira', area: 'INSS', number: '5008721-22.2025.4.03.6100', status: 'DOCUMENTACAO', due: 'Amanhã', dueTone: 'soon', initials: 'CN', color: 'violet', owner: 'Ana Lima' },
  { id: '04', title: 'Pensão por morte — dependente menor', client: 'Eduardo Ribeiro Lima', area: 'INSS', number: '5003410-09.2025.4.03.6100', status: 'DOCUMENTACAO', initials: 'EL', color: 'amber', owner: 'Marina Alves' },
  { id: '05', title: 'Indenização por acidente de trânsito', client: 'Paulo Henrique Mendes', area: 'DPVAT', number: '1003284-71.2025.8.26.0100', status: 'PROTOCOLO', due: 'Em 5 dias', initials: 'PM', color: 'green', owner: 'Lucas Prado' },
  { id: '06', title: 'Aposentadoria especial — atividade insalubre', client: 'Silvia Martins Rocha', area: 'INSS', number: '5006190-35.2024.4.03.6100', status: 'EM_ANDAMENTO', due: 'Em 2 dias', initials: 'SM', color: 'pink', owner: 'Ana Lima' },
  { id: '07', title: 'Restabelecimento de benefício', client: 'João Pedro Carvalho', area: 'INSS', number: '5004701-63.2024.4.03.6100', status: 'EM_ANDAMENTO', initials: 'JC', color: 'slate', owner: 'Marina Alves' },
  { id: '08', title: 'Recurso administrativo — BPC/LOAS', client: 'Helena Duarte Freitas', area: 'INSS', number: '5007724-04.2025.4.03.6100', status: 'AGUARDANDO', due: 'Vence hoje', dueTone: 'urgent', initials: 'HF', color: 'gold', owner: 'Lucas Prado' },
  { id: '09', title: 'Aposentadoria por idade rural', client: 'Antônio Ferreira Lima', area: 'INSS', number: '5002189-55.2024.4.03.6100', status: 'CONCLUIDO', initials: 'AF', color: 'teal', owner: 'Ana Lima' },
]

function App() {
  const [items, setItems] = useState(initial)
  const [query, setQuery] = useState('')
  const [mine, setMine] = useState(false)
  const [modal, setModal] = useState(false)
  const [title, setTitle] = useState('')
  const [client, setClient] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const visible = useMemo(() => items.filter(p => (!mine || p.owner === 'Ana Lima') && `${p.title} ${p.client} ${p.number} ${p.area}`.toLowerCase().includes(query.toLowerCase())), [items, mine, query])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const move = (id: string, status: Status) => setItems(list => list.map(p => p.id === id ? { ...p, status } : p))
  const addProcess = (e: FormEvent) => { e.preventDefault(); if (!title.trim() || !client.trim()) return; setItems(list => [{ id: String(Date.now()), title: title.trim(), client: client.trim(), area: 'INSS', number: 'Novo processo', status: 'TRIAGEM', initials: client.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase(), color: 'blue', owner: 'Ana Lima' }, ...list]); setTitle(''); setClient(''); setModal(false); setNotice('Processo adicionado à triagem') }
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#kanban" aria-label="ADLO, página inicial"><span className="brand-mark"><Gavel size={20} strokeWidth={2.2}/></span><span>adlo<span className="brand-dot">.</span></span></a>
      <div className="workspace"><div className="workspace-icon">C</div><div className="workspace-copy"><strong>Costa & Associados</strong><span>Escritório de advocacia</span></div><ChevronDown size={15} className="muted"/></div>
      <div className="nav-label">ESCRITÓRIO</div>
      <nav className="side-nav" aria-label="Navegação principal">
        <a className="nav-item active" href="#kanban" aria-current="page"><LayoutGrid size={18}/><span>Processos</span><span className="nav-count">24</span></a>
        <span className="nav-item unavailable" aria-disabled="true" title="Disponível em breve"><Users size={18}/><span>Clientes</span><span className="soon">Em breve</span></span>
        <span className="nav-item unavailable" aria-disabled="true" title="Disponível em breve"><CalendarDays size={18}/><span>Agendamento</span><span className="soon">Em breve</span></span>
      </nav>
      <div className="sidebar-bottom"><a className="nav-item" href="mailto:suporte@adlo.app"><CircleHelp size={18}/><span>Central de ajuda</span></a><a className="nav-item" href="#configuracoes" onClick={e => {e.preventDefault();setNotice('Configurações estarão disponíveis em breve')}}><Settings2 size={18}/><span>Configurações</span></a><div className="profile"><div className="avatar avatar-profile">AL</div><div className="profile-copy"><strong>Ana Lima</strong><span>Advogada</span></div><MoreHorizontal size={19} className="muted"/></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Fechar navegação" onClick={() => setMobileNav(false)}/>}
    <main className="main-area" id="kanban">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Abrir navegação" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumbs"><span>Escritório</span><ChevronRight size={14}/><strong>Processos</strong></div><div className="top-actions"><span className="today-label">Quinta-feira, 5 de novembro</span><button className="icon-button notification" aria-label="Notificações" onClick={() => setNotice('Você está em dia com as notificações')}><Bell size={18}/><i/></button><div className="avatar avatar-profile top-avatar">AL</div></div></header>
      <section className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> VISÃO GERAL DO ESCRITÓRIO</div><h1>Processos</h1><p className="subtitle">Acompanhe cada etapa dos seus casos.</p></div><button className="primary-button" onClick={() => setModal(true)}><Plus size={17} strokeWidth={2.3}/> Novo processo</button></div>
        <div className="summary-row"><div className="summary-card"><div className="summary-icon total-icon"><BriefcaseBusiness size={17}/></div><div><span>Total de processos</span><strong>24 <small>ativos</small></strong></div><span className="summary-note">no escritório</span></div><div className="summary-card"><div className="summary-icon deadline-icon"><Clock3 size={17}/></div><div><span>Prazos próximos</span><strong className="deadline-number">03 <small>nos próximos 7 dias</small></strong></div><span className="pulse-dot"/></div><div className="summary-card completion-card"><div className="summary-icon done-icon"><Check size={17}/></div><div><span>Concluídos este mês</span><strong>08 <small>processos</small></strong></div><span className="growth">+2 vs. mês anterior</span></div></div>
        <section className="board-section" aria-label="Quadro de processos"><div className="board-toolbar"><div className="board-tabs"><button className={!mine ? 'board-tab selected' : 'board-tab'} onClick={() => setMine(false)}>Todos os processos <span>24</span></button><button className={mine ? 'board-tab selected' : 'board-tab'} onClick={() => setMine(true)}>Meus processos <span>08</span></button></div><div className="toolbar-actions"><label className="search-box"><Search size={16}/><input ref={searchRef} aria-label="Buscar processos" placeholder="Buscar processo..." value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></label><button className="secondary-button filter-button" onClick={() => setNotice('Filtros avançados estarão disponíveis em breve')}><SlidersHorizontal size={16}/><span>Filtros</span><span className="filter-count">2</span></button><button className="icon-button view-toggle" aria-label="Visualização em quadro"><LayoutGrid size={17}/></button><button className="icon-button sort-button" aria-label="Ordenar processos" onClick={() => setNotice('Ordenação por prazo aplicada')}><ArrowDownUp size={17}/></button></div></div>
          <div className="board-scroll"><div className="board-grid">{columns.map((col, index) => { const cards = visible.filter(p => p.status === col.id); return <section className="kanban-column" key={col.id} aria-label={`${col.label}, ${cards.length} processos`} onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault();if(dragging)move(dragging,col.id);setDragging(null)}}><header className="column-header"><div className="column-title"><i style={{background:col.color}}/><h2>{col.label}</h2><span className="column-count">{cards.length}</span></div><button className="column-menu" aria-label={`Opções da coluna ${col.label}`} onClick={() => setNotice(`Coluna ${col.label}`)}><MoreHorizontal size={18}/></button></header><div className="column-cards">{cards.map(p => <article className={`process-card ${dragging === p.id ? 'is-dragging' : ''}`} key={p.id} draggable onDragStart={() => setDragging(p.id)} onDragEnd={() => setDragging(null)}><div className="card-top"><span className="area-tag">{p.area}</span><button className="card-menu" aria-label={`Mais opções: ${p.title}`} onClick={() => setNotice(`Processo de ${p.client}`)}><MoreHorizontal size={17}/></button></div><h3>{p.title}</h3><div className="client-row"><div className={`avatar avatar-${p.color}`}>{p.initials}</div><span>{p.client}</span></div><div className="process-number"><FileText size={13}/><span>{p.number}</span></div>{p.due && <div className={`due-chip ${p.dueTone || ''}`}><Clock3 size={12}/>{p.due}</div>}<footer className="card-footer"><div className="owner"><div className="avatar avatar-owner">{p.owner.split(' ').map(x=>x[0]).join('')}</div><span>{p.owner}</span></div><button className="move-card" title="Mover para próxima etapa" aria-label={`Mover ${p.client} para próxima etapa`} onClick={() => {const next=columns[Math.min(index+1,columns.length-1)]; if(next)move(p.id,next.id)}}><ChevronRight size={15}/></button></footer></article>)}<button className="add-card" onClick={() => {setTitle('');setClient('');setModal(true)}}><Plus size={15}/> Adicionar processo</button></div></section> })}</div></div>
          <div className="board-footer"><span>Exibindo <strong>{visible.length}</strong> de 24 processos</span><div className="pagination"><button className="icon-button" aria-label="Página anterior" disabled><ChevronLeft size={16}/></button><span>Página <strong>1</strong> de 3</span><button className="icon-button" aria-label="Próxima página" onClick={() => setNotice('Você está vendo os processos recentes')}><ChevronRight size={16}/></button></div></div>
        </section>
      </section>
    </main>
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={e => {if(e.target===e.currentTarget)setModal(false)}}><form className="process-modal" onSubmit={addProcess} aria-labelledby="modal-title"><header><div><span className="modal-kicker">NOVO CADASTRO</span><h2 id="modal-title">Adicionar processo</h2><p>Comece registrando as informações principais.</p></div><button type="button" className="icon-button" aria-label="Fechar" onClick={() => setModal(false)}><X size={18}/></button></header><label>Nome do processo<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Concessão de benefício" required/></label><label>Nome do cliente<input value={client} onChange={e=>setClient(e.target.value)} placeholder="Nome completo" required/></label><div className="modal-note"><span className="column-dot"/> O processo será criado na etapa <strong>Triagem</strong>.</div><footer><button type="button" className="secondary-button" onClick={() => setModal(false)}>Cancelar</button><button className="primary-button" type="submit"><Plus size={16}/> Criar processo</button></footer></form></div>}
    {notice && <div className="toast" role="status"><Check size={16}/>{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={15}/></button></div>}
  </div>
}

export default App

