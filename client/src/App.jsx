import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import ServerSidebar from './components/ServerSidebar.jsx';
import ChannelSidebar from './components/ChannelSidebar.jsx';
import ChatArea from './components/ChatArea.jsx';
import VoiceChannel from './components/VoiceChannel.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import AddServerModal from './components/AddServerModal.jsx';
import ProfileModal from './components/ProfileModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import ScreenShareSourcePicker from './components/ScreenShareSourcePicker.jsx';
import FriendsScreen from './components/FriendsScreen.jsx';
import DirectMessageScreen from './components/DirectMessageScreen.jsx';
import { SERVER_URL, apiFetch } from './api.js';

export default function App() {
  const [sessao, setSessao] = useState(() => {
    const salvo = localStorage.getItem('sessao');
    return salvo ? JSON.parse(salvo) : null;
  });
  const [status, setStatus] = useState('conectando...');
  const [socket, setSocket] = useState(null);

  const [servidores, setServidores] = useState([]);
  const [servidorAtivoId, setServidorAtivoId] = useState(null);
  const [canais, setCanais] = useState([]);
  const [canalAtivo, setCanalAtivo] = useState(null);
  const [canalDeVoz, setCanalDeVoz] = useState(null);
  const [vozEstado, setVozEstado] = useState({
    participantes: [],
    micMudo: false,
    audioMudo: false,
    compartilhandoTela: false,
    erro: '',
    erroCompartilhamento: '',
    conectando: true,
  });
  const voiceChannelRef = useRef(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [settingsAberto, setSettingsAberto] = useState(false);
  const [pickerTelaAberto, setPickerTelaAberto] = useState(false);

  // view: 'servidor' | 'amigos' | 'dm'
  const [view, setView] = useState('servidor');
  const [amigos, setAmigos] = useState([]);
  const [dmAtiva, setDmAtiva] = useState(null); // amigo com quem está conversando

  // Conecta o socket assim que há sessão.
  useEffect(() => {
    if (!sessao) return;
    const s = io(SERVER_URL, { auth: { token: sessao.token } });
    s.on('connect', () => setStatus('conectado ao servidor'));
    s.on('disconnect', () => setStatus('desconectado'));
    setSocket(s);
    return () => s.disconnect();
  }, [sessao]);

  // Carrega os servidores do usuário assim que loga.
  useEffect(() => {
    if (!sessao) return;
    apiFetch('/api/servidores', sessao.token)
      .then((lista) => {
        setServidores(lista);
        if (lista.length > 0) setServidorAtivoId(lista[0].id);
      })
      .catch(() => {});
  }, [sessao]);

  // Carrega a lista de amigos assim que loga.
  useEffect(() => {
    if (!sessao) return;
    apiFetch('/api/amigos', sessao.token)
      .then(setAmigos)
      .catch(() => {});
  }, [sessao]);

  // Atualiza a lista de amigos em tempo real quando alguém fica online/offline
  // (sem precisar recarregar tudo do zero a cada evento).
  useEffect(() => {
    if (!socket) return;
    function online({ usuarioId }) {
      setAmigos((atual) => atual.map((a) => (a.id === usuarioId ? { ...a, online: true } : a)));
    }
    function offline({ usuarioId }) {
      setAmigos((atual) => atual.map((a) => (a.id === usuarioId ? { ...a, online: false } : a)));
    }
    socket.on('amigo-online', online);
    socket.on('amigo-offline', offline);
    return () => {
      socket.off('amigo-online', online);
      socket.off('amigo-offline', offline);
    };
  }, [socket]);

  // Carrega os canais sempre que o servidor ativo muda.
  useEffect(() => {
    if (!sessao || !servidorAtivoId) return;
    apiFetch(`/api/servidores/${servidorAtivoId}/canais`, sessao.token)
      .then((lista) => {
        setCanais(lista);
        setCanalAtivo(lista[0] || null);
      })
      .catch(() => {});
  }, [sessao, servidorAtivoId]);

  function autenticar(token, usuario) {
    const novaSessao = { token, usuario };
    localStorage.setItem('sessao', JSON.stringify(novaSessao));
    setSessao(novaSessao);
  }

  function sair() {
    localStorage.removeItem('sessao');
    socket?.disconnect();
    setSessao(null);
    setServidores([]);
    setServidorAtivoId(null);
    setCanais([]);
    setCanalAtivo(null);
    setCanalDeVoz(null);
    setAmigos([]);
    setDmAtiva(null);
    setView('servidor');
  }

  async function criarServidor(nome) {
    const novo = await apiFetch('/api/servidores', sessao.token, {
      method: 'POST',
      body: JSON.stringify({ nome }),
    });
    setServidores((atual) => [
      ...atual,
      { id: novo.id, nome: novo.nome, codigo_convite: novo.codigo_convite, papel: 'dono' },
    ]);
    setServidorAtivoId(novo.id);
    setView('servidor');
  }

  async function excluirServidor(id) {
    await apiFetch(`/api/servidores/${id}`, sessao.token, { method: 'DELETE' });
    setServidores((atual) => {
      const restantes = atual.filter((s) => s.id !== id);
      if (servidorAtivoId === id) {
        setServidorAtivoId(restantes[0]?.id ?? null);
      }
      return restantes;
    });
  }

  async function entrarComCodigo(codigo) {
    const servidor = await apiFetch('/api/servidores/entrar', sessao.token, {
      method: 'POST',
      body: JSON.stringify({ codigo }),
    });
    const lista = await apiFetch('/api/servidores', sessao.token);
    setServidores(lista);
    setServidorAtivoId(servidor.id);
    setView('servidor');
    // A pessoa dona do servidor virou um novo amigo (compartilham servidor agora).
    apiFetch('/api/amigos', sessao.token).then(setAmigos).catch(() => {});
  }

  async function salvarPerfil(dados) {
    const atualizado = await apiFetch('/api/perfil', sessao.token, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    });
    const novaSessao = { token: atualizado.token, usuario: atualizado.usuario };
    localStorage.setItem('sessao', JSON.stringify(novaSessao));
    setSessao(novaSessao);
  }

  function selecionarCanal(canal) {
    setCanalAtivo(canal);
    if (canal.tipo === 'voz') setCanalDeVoz(canal);
  }

  function desconectarVoz() {
    setCanalDeVoz(null);
  }

  const vozAcoes = {
    onAlternarMic: () => voiceChannelRef.current?.alternarMudo(),
    onAlternarAudio: () => voiceChannelRef.current?.alternarAudio(),
    onIniciarTela: () => setPickerTelaAberto(true),
    onPararTela: () => voiceChannelRef.current?.pararCompartilhamento(),
    onDesconectar: desconectarVoz,
  };

  function handleCompartilharTela(config) {
    voiceChannelRef.current?.iniciarCompartilhamento(config);
    setPickerTelaAberto(false);
  }

  function selecionarServidor(id) {
    setServidorAtivoId(id);
    setView('servidor');
  }

  function abrirAmigos() {
    setView('amigos');
  }

  function abrirDM(amigo) {
    setDmAtiva(amigo);
    setView('dm');
  }

  if (!sessao) {
    return <LoginScreen onAutenticado={autenticar} />;
  }

  const servidorAtivo = servidores.find((s) => s.id === servidorAtivoId);
  const usuarioLogado = {
    nome: sessao.usuario.nome,
    status: sessao.usuario.status,
    avatarCor: sessao.usuario.avatar_cor,
    avatarUrl: sessao.usuario.avatar_url,
    online: true,
  };

  return (
    <div className="app">
      <ServerSidebar
        servidores={servidores}
        servidorAtivoId={servidorAtivoId}
        viewAtiva={view === 'amigos' || view === 'dm' ? 'amigos' : 'servidor'}
        onSelecionar={selecionarServidor}
        onAbrirAmigos={abrirAmigos}
        onAbrirModal={() => setModalAberto(true)}
      />

      {view === 'servidor' && servidorAtivo && canalAtivo && (
        <>
          <ChannelSidebar
            servidorNome={servidorAtivo.nome}
            codigoConvite={servidorAtivo.codigo_convite}
            souDono={servidorAtivo.papel === 'dono'}
            onExcluirServidor={() => excluirServidor(servidorAtivo.id)}
            canais={canais}
            canalAtivoId={canalAtivo.id}
            onSelecionar={selecionarCanal}
            usuario={usuarioLogado}
            onSair={sair}
            onAbrirPerfil={() => setPerfilAberto(true)}
            onAbrirConfiguracao={() => setSettingsAberto(true)}
            canalDeVoz={canalDeVoz}
            participantesVoz={vozEstado.participantes}
            vozEstado={vozEstado}
            vozAcoes={vozAcoes}
            nomeUsuarioNaVoz={sessao.usuario.nome}
          />
          <ChatArea
            canal={canalAtivo}
            statusConexao={status}
            socket={socket}
            token={sessao.token}
            nomeUsuario={sessao.usuario.nome}
          />
        </>
      )}

      {view === 'servidor' && (!servidorAtivo || !canalAtivo) && (
        <div className="content">
          <div className="content__body">
            <p style={{ color: '#949ba4' }}>
              Você ainda não faz parte de nenhum servidor. Clique no "+" na barra à
              esquerda para criar um ou entrar com um código de convite.
            </p>
          </div>
        </div>
      )}

      {view === 'amigos' && <FriendsScreen amigos={amigos} onAbrirDM={abrirDM} />}

      {view === 'dm' && dmAtiva && (
        <DirectMessageScreen amigo={dmAtiva} socket={socket} token={sessao.token} meuId={sessao.usuario.id} />
      )}

      {canalDeVoz && (
        <VoiceChannel
          ref={voiceChannelRef}
          canal={canalDeVoz}
          socket={socket}
          nomeUsuario={sessao.usuario.nome}
          onDesconectar={desconectarVoz}
          onEstadoChange={setVozEstado}
        />
      )}

      {modalAberto && (
        <AddServerModal
          onFechar={() => setModalAberto(false)}
          onCriar={criarServidor}
          onEntrar={entrarComCodigo}
        />
      )}
      {perfilAberto && (
        <ProfileModal
          usuario={sessao.usuario}
          onFechar={() => setPerfilAberto(false)}
          onSalvar={salvarPerfil}
        />
      )}

      {settingsAberto && (
        <SettingsModal
          onFechar={() => setSettingsAberto(false)}
          onSalvarConfiguracao={(config) => {
            // Configuração já foi salva em localStorage no componente
            voiceChannelRef.current?.aplicarConfiguracao(config);
          }}
        />
      )}

      {pickerTelaAberto && (
        <ScreenShareSourcePicker
          onFechar={() => setPickerTelaAberto(false)}
          onSelecionar={handleCompartilharTela}
        />
      )}
    </div>
  );
}
