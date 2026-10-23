# Automatic Media Converter

Converte imagens para WebP e áudio para Ogg/Opus **antes do upload**, enviando somente o resultado ao Foundry. Sem serviços externos ou dependências.

## Instalação

Copie `module.json`, `scripts/` e `lang/` para `{userData}/Data/modules/automatic-media-converter/`. Reinicie o Foundry e ative o módulo no mundo. As opções ficam em **Configurações → Configurar opções → Automatic Media Converter**, usando controles e CSS nativos.

Compatibilidade pretendida: Foundry 13–14. Versão inicial ainda sem teste dentro de uma instalação real do Foundry. Não há release remoto publicado.

## Funcionamento

- `mapa.png` vira `mapa.webp`; `musica.mp3` vira `musica.ogg`. Dimensões e transparência das imagens são mantidas. Metadados não são preservados.
- Envolve `foundry.applications.apps.FilePicker.implementation.upload`, preservando pasta, origem, bucket, opções, permissões e resposta. Caminhos devolvidos apontam para o arquivo convertido. Upload persistente é coberto quando delega a esse método.
- Funciona nos clientes com o módulo ativo e mundo aberto. Não cobre setup, acesso direto ao servidor nem módulos que usem transporte próprio. Não é imposição no servidor.
- WebP, Ogg e Opus existentes passam sem recodificação. Vídeos e outros documentos passam intactos. Desativar a opção permite enviar originais.
- Não converte arquivos antigos nem apaga originais existentes. Colisões de nomes seguem o comportamento do Foundry/provedor: `mapa.png` e `mapa.jpg` têm o mesmo destino.
- Foco em JPEG/PNG estáticos e áudio decodificável pelo navegador. GIF e animações PNG/AVIF detectadas são bloqueados para evitar perda da animação. Outros formatos dependem do navegador.
- Áudio: Opus em Ogg verdadeiro, 48 kHz, mono/estéreo. Requer navegador com WebCodecs/Opus e metadados de inicialização disponíveis; use Chromium atualizado por HTTPS ou localhost. Sem suporte, bloqueia o envio com mensagem.
- Qualquer falha de conversão bloqueia o envio, sem alternativa que envie o original. O arquivo local permanece intacto.
- Limite padrão de entrada: 100 MB. Áudio é decodificado na memória e pode ocupar muito mais memória que o arquivo comprimido. Imagens grandes também consomem memória. Conversão com perdas pode gerar arquivos maiores em alguns casos.

## Validação

Execute `node --test` com Node.js 22 ou superior. Testes automatizados não substituem validação no navegador/Foundry.

Validação manual pendente em Foundry 13 e 14:

1. Enviar JPEG e PNG transparente como GM e jogador autorizado; conferir visualização, caminho e ausência de original no servidor.
2. Enviar MP3 e WAV mono/estéreo; conferir reprodução, início, fim e duração do Ogg em playlists.
3. Usar uploads em atores e cenas e conferir referências após recarregar.
4. Testar arquivos corrompidos, GIF, limite de tamanho e navegador sem WebCodecs; nenhum original deve chegar ao servidor.
5. Validar bucket S3, armazenamento persistente e compatibilidade com módulos de upload da instalação.

## Referências oficiais

- [Módulos e manifesto](https://foundryvtt.com/article/module-development/)
- [FilePicker v13](https://foundryvtt.com/api/v13/classes/foundry.applications.apps.FilePicker.html)
- [FilePicker v14](https://foundryvtt.com/api/v14/classes/foundry.applications.apps.FilePicker.html)
- [Configurações nativas](https://foundryvtt.com/api/v13/interfaces/foundry.types.SettingConfig.html)
- [WebCodecs Opus](https://www.w3.org/TR/webcodecs-opus-codec-registration/)
- [Ogg Opus RFC 7845](https://www.rfc-editor.org/rfc/rfc7845)
