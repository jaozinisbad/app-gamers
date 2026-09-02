import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Servidores STUN públicos e gratuitos do Google — ajudam os dois lados
// a descobrirem como se alcançar através da internet (NAT traversal).
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// Esse componente não controla mais sua própria interface de
// participantes/botões — isso agora vive na barra lateral (para ficar
// igual ao Discord). Em vez disso, ele expõe funções via ref (mutar,
// compartilhar tela, etc.) e avisa o componente pai sempre que o estado
// muda, através de onEstadoChange. O que ele ainda renderiza sozinho são
// só os vídeos de tela compartilhada, quando existem.
const VoiceChannel = forwardRef(function VoiceChannel(
  { canal, socket, nomeUsuario, onDesconectar, onEstadoChange },
  ref
) {
  const [participantes, setParticipantes] = useState([]); // [{socketId, nome}]
  const [micMudo, setMicMudo] = useState(false);
  const [audioMudo, setAudioMudo] = useState(false);
  const [erro, setErro] = useState('');
  const [erroCompartilhamento, setErroCompartilhamento] = useState('');
  const [conectando, setConectando] = useState(true);
  const [compartilhandoTela, setCompartilhandoTela] = useState(false);
  const [resolucaoTela, setResolucaoTela] = useState('720p');
  const [fpsTela, setFpsTela] = useState('30');
  const [telasRemotas, setTelasRemotas] = useState({}); // socketId -> MediaStream

  const streamLocalRef = useRef(null);
  const telaLocalRef = useRef(null);
  const conexoesRef = useRef({}); // socketId -> RTCPeerConnection
  const audiosRef = useRef({}); // socketId -> HTMLAudioElement
  const audioMudoRef = useRef(false);
  const contextoAudioRef = useRef(null);
  const telasComSomRef = useRef(new Set());
  const gainNodeRef = useRef(null); // Nó de ganho para controlar volume
  const configuracaoAudioRef = useRef(null);

  // Avisa o App sempre que algo que a sidebar precisa mostrar mudar.
  useEffect(() => {
    onEstadoChange?.({ participantes, micMudo, audioMudo, compartilhandoTela, erro, erroCompartilhamento, conectando });
  }, [participantes, micMudo, audioMudo, compartilhandoTela, erro, erroCompartilhamento, conectando]);

  // Inicializa a configuração de áudio do localStorage
  useEffect(() => {
    const salva = localStorage.getItem('configuracoesAudio');
    if (salva) {
      try {
        configuracaoAudioRef.current = JSON.parse(salva);
      } catch {
        configuracaoAudioRef.current = { volumeEntrada: 100, volumeSaida: 100, microfoneId: '', foneId: '' };
      }
    } else {
      configuracaoAudioRef.current = { volumeEntrada: 100, volumeSaida: 100, microfoneId: '', foneId: '' };
    }
  }, []);

  function tocarEfeito(tipo) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const contexto = contextoAudioRef.current || new AudioContext();
      contextoAudioRef.current = contexto;
      contexto.resume().catch(() => {});

      const frequencias = {
        entrar: [523.25, 659.25],
        sair: [659.25, 523.25],
        transmitir: [659.25, 783.99],
        transmissaoRecebida: [783.99, 987.77],
      }[tipo];
      if (!frequencias) return;

      const agora = contexto.currentTime;
      frequencias.forEach((frequencia, indice) => {
        const oscilador = contexto.createOscillator();
        const ganho = contexto.createGain();
        oscilador.type = 'sine';
        oscilador.frequency.value = frequencia;
        ganho.gain.setValueAtTime(0.0001, agora + indice * 0.1);
        ganho.gain.exponentialRampToValueAtTime(0.08, agora + indice * 0.1 + 0.02);
        ganho.gain.exponentialRampToValueAtTime(0.0001, agora + indice * 0.1 + 0.18);
        oscilador.connect(ganho);
        ganho.connect(contexto.destination);
        oscilador.start(agora + indice * 0.1);
        oscilador.stop(agora + indice * 0.1 + 0.2);
      });
    } catch (err) {
      // Efeitos sonoros não podem interromper a chamada.
    }
  }

  useEffect(() => {
    if (!socket) return;
    let cancelado = false;

    async function renegociar(pc, socketId) {
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      socket.emit('webrtc-oferta', { para: socketId, oferta });
    }

    function criarConexao(socketId) {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      conexoesRef.current[socketId] = pc;

      streamLocalRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, streamLocalRef.current);
      });
      telaLocalRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, telaLocalRef.current);
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc-candidato', { para: socketId, candidato: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        if (e.track.kind === 'audio') {
          let audio = audiosRef.current[socketId];
          if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            audio.muted = audioMudoRef.current;
            audiosRef.current[socketId] = audio;
          }
          audio.srcObject = e.streams[0];
        } else if (e.track.kind === 'video') {
          if (!telasComSomRef.current.has(socketId)) {
            telasComSomRef.current.add(socketId);
            tocarEfeito('transmissaoRecebida');
          }
          setTelasRemotas((atual) => ({ ...atual, [socketId]: e.streams[0] }));
          e.track.onended = () => {
            setTelasRemotas((atual) => {
              const copia = { ...atual };
              delete copia[socketId];
              return copia;
            });
          };
        }
      };

      return pc;
    }

    function fecharConexao(socketId) {
      conexoesRef.current[socketId]?.close();
      delete conexoesRef.current[socketId];
      if (audiosRef.current[socketId]) {
        audiosRef.current[socketId].srcObject = null;
        delete audiosRef.current[socketId];
      }
      setTelasRemotas((atual) => {
        const copia = { ...atual };
        delete copia[socketId];
        return copia;
      });
    }

    function removerTelaRemota(socketId) {
      telasComSomRef.current.delete(socketId);
      setTelasRemotas((atual) => {
        const copia = { ...atual };
        const stream = copia[socketId];
        stream?.getVideoTracks().forEach((track) => track.stop());
        delete copia[socketId];
        return copia;
      });
    }

    async function iniciar() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamLocalRef.current = stream;
        setConectando(false);
        socket.emit('entrar-canal-voz', canal.id);
      } catch (err) {
        setErro('Não foi possível acessar o microfone. Verifique as permissões do sistema.');
        setConectando(false);
      }
    }

    socket.on('peers-existentes', ({ peers }) => {
      setParticipantes(peers);
      peers.forEach((p) => {
        const pc = criarConexao(p.socketId);
        renegociar(pc, p.socketId);
      });
    });

    socket.on('novo-peer', ({ socketId, nome, avatarCor, avatarUrl }) => {
      tocarEfeito('entrar');
      setParticipantes((atual) => [...atual, { socketId, nome, avatarCor: avatarCor || '#5865f2', avatarUrl: avatarUrl || null }]);
    });

    socket.on('webrtc-oferta', async ({ de, oferta }) => {
      const pc = conexoesRef.current[de] || criarConexao(de);
      await pc.setRemoteDescription(oferta);
      const resposta = await pc.createAnswer();
      await pc.setLocalDescription(resposta);
      socket.emit('webrtc-resposta', { para: de, resposta });
    });

    socket.on('webrtc-resposta', async ({ de, resposta }) => {
      const pc = conexoesRef.current[de];
      if (pc) await pc.setRemoteDescription(resposta);
    });

    socket.on('webrtc-candidato', async ({ de, candidato }) => {
      const pc = conexoesRef.current[de];
      if (pc) {
        try {
          await pc.addIceCandidate(candidato);
        } catch (e) {
          // candidato pode chegar antes da remote description em alguns casos; ignora
        }
      }
    });

    socket.on('peer-saiu', ({ socketId }) => {
      tocarEfeito('sair');
      telasComSomRef.current.delete(socketId);
      fecharConexao(socketId);
      setParticipantes((atual) => atual.filter((p) => p.socketId !== socketId));
    });

    socket.on('tela-parada', ({ socketId }) => {
      removerTelaRemota(socketId);
    });

    iniciar();

    return () => {
      cancelado = true;
      socket.emit('sair-canal-voz');
      socket.off('peers-existentes');
      socket.off('novo-peer');
      socket.off('webrtc-oferta');
      socket.off('webrtc-resposta');
      socket.off('webrtc-candidato');
      socket.off('peer-saiu');
      socket.off('tela-parada');

      Object.keys(conexoesRef.current).forEach(fecharConexao);
      streamLocalRef.current?.getTracks().forEach((t) => t.stop());
      streamLocalRef.current = null;
      telaLocalRef.current?.getTracks().forEach((t) => t.stop());
      telaLocalRef.current = null;
      setParticipantes([]);
      setTelasRemotas({});
      telasComSomRef.current.clear();
      setCompartilhandoTela(false);
      setAudioMudo(false);
      contextoAudioRef.current?.close().catch(() => {});
      contextoAudioRef.current = null;
    };
  }, [canal.id, socket]);

  function alternarMudo() {
    const stream = streamLocalRef.current;
    if (!stream) return;
    const novoEstado = !micMudo;
    stream.getAudioTracks().forEach((t) => (t.enabled = !novoEstado));
    setMicMudo(novoEstado);
  }

  function alternarAudio() {
    const novoEstado = !audioMudo;
    audioMudoRef.current = novoEstado;
    Object.values(audiosRef.current).forEach((audio) => {
      audio.muted = novoEstado;
    });
    setAudioMudo(novoEstado);
  }

  async function renegociarComTodos() {
    for (const [socketId, pc] of Object.entries(conexoesRef.current)) {
      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);
      socket.emit('webrtc-oferta', { para: socketId, oferta });
    }
  }

  async function iniciarCompartilhamento(config) {
    try {
      setErroCompartilhamento('');
      const res = config?.resolucao || resolucaoTela;
      const fps = config?.fps || Number(fpsTela);
      const dimensoes = res === '1080p'
        ? { largura: 1920, altura: 1080 }
        : { largura: 1280, altura: 720 };

      // Usa getDisplayMedia padrão do navegador
      // No Electron, isso vai listar as telas graças ao desktopCapturer exposto no preload
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: dimensoes.largura, max: dimensoes.largura },
          height: { ideal: dimensoes.altura, max: dimensoes.altura },
          frameRate: { ideal: fps, max: fps },
        },
      });

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.contentHint = 'motion';
      videoTrack.onended = () => pararCompartilhamento();

      telaLocalRef.current = stream;
      setCompartilhandoTela(true);
      tocarEfeito('transmitir');

      Object.values(conexoesRef.current).forEach((pc) => {
        const remetente = pc.addTrack(videoTrack, stream);
        const parametros = remetente.getParameters();
        parametros.encodings = (parametros.encodings || [{}]).map((encoding) => ({
          ...encoding,
          maxFramerate: fps,
        }));
        remetente.setParameters(parametros).catch(() => {});
      });
      await renegociarComTodos();
    } catch (err) {
      setErroCompartilhamento(
        err?.name === 'AbortError'
          ? 'Compartilhamento de tela cancelado.'
          : 'Não foi possível compartilhar a tela. Verifique as permissões do sistema.',
      );
    }
  }

  async function pararCompartilhamento() {
    const stream = telaLocalRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];

    Object.values(conexoesRef.current).forEach((pc) => {
      const remetente = pc.getSenders().find((s) => s.track === videoTrack);
      if (remetente) pc.removeTrack(remetente);
    });

    socket.emit('tela-parada');
    stream.getTracks().forEach((t) => t.stop());
    telaLocalRef.current = null;
    setCompartilhandoTela(false);
    await renegociarComTodos();
  }

  async function abrirTelaCheia(video) {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await video.requestFullscreen();
      }
    } catch (err) {
      setErroCompartilhamento('Não foi possível abrir a transmissão em tela cheia.');
    }
  }

  async function aplicarConfiguracao(config) {
    if (!config) return;
    
    // Atualizar volume de entrada
    if (config.volumeEntrada !== undefined) {
      const volume = Math.max(0, Math.min(200, config.volumeEntrada)) / 100;
      
      // Se não tiver gainNode, cria um
      if (!gainNodeRef.current) {
        const ctx = contextoAudioRef.current || new (window.AudioContext || window.webkitAudioContext)();
        contextoAudioRef.current = ctx;
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.connect(ctx.destination);
      }
      
      gainNodeRef.current.gain.setValueAtTime(volume, contextoAudioRef.current.currentTime);
    }

    // Atualizar volume de saída
    if (config.volumeSaida !== undefined) {
      const volume = Math.max(0, Math.min(200, config.volumeSaida)) / 100;
      Object.values(audiosRef.current).forEach((audio) => {
        audio.volume = volume;
      });
    }

    // Atualizar microfone (se tiver suporte)
    if (config.microfoneId && window.electronAPI?.changeAudioDevice) {
      try {
        await window.electronAPI.changeAudioDevice('audioinput', config.microfoneId);
      } catch (e) {
        // Troca de dispositivo não suportada
      }
    }

    // Atualizar fone (se tiver suporte)
    if (config.foneId && window.electronAPI?.changeAudioDevice) {
      try {
        await window.electronAPI.changeAudioDevice('audiooutput', config.foneId);
      } catch (e) {
        // Troca de dispositivo não suportada
      }
    }
  }

  // Funções chamáveis de fora (pela barra de controle na sidebar).
  useImperativeHandle(ref, () => ({
    alternarMudo,
    alternarAudio,
    iniciarCompartilhamento,
    pararCompartilhamento,
    aplicarConfiguracao,
  }));

  const telasRemotasLista = Object.entries(telasRemotas);
  const temTelaPraMostrar = compartilhandoTela || telasRemotasLista.length > 0;

  if (!temTelaPraMostrar) return null;

  return (
    <div className="content voice-call-panel">
      <div className="content__header">🔊 {canal.nome} — transmissão de tela</div>
      <div className="content__body">
        <div className="telas-compartilhadas">
          {compartilhandoTela && (
            <div className="tela-tile">
              <video
                autoPlay
                muted
                playsInline
                ref={(el) => {
                  if (el && telaLocalRef.current) el.srcObject = telaLocalRef.current;
                }}
              />
              <div className="tela-tile__label">Sua tela (você)</div>
            </div>
          )}
          {telasRemotasLista.map(([socketId, stream]) => {
            const participante = participantes.find((p) => p.socketId === socketId);
            return (
              <div className="tela-tile" key={socketId}>
                <video
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el) el.srcObject = stream;
                  }}
                />
                <div className="tela-tile__label">{participante?.nome || 'Alguém'}</div>
                <button
                  className="tela-tile__fullscreen"
                  onClick={(e) => abrirTelaCheia(e.currentTarget.parentElement.querySelector('video'))}
                  title={`Abrir transmissão de ${participante?.nome || 'Alguém'} em tela cheia`}
                  type="button"
                >
                  Tela cheia
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default VoiceChannel;
