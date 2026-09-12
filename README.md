# Dare Stunts TV

Jogo de corridas em primeira pessoa para **Android TV**, ao estilo do *Stunts*
(MS-DOS, 1990): loops, corkscrews, saltos e túneis, contra o relógio.

Sem dependências. Sem npm, sem frameworks, sem bibliotecas — WebGL puro para o
mundo 3D, Canvas 2D para o cockpit e Web Audio sintetizado para o som. A app não
pede **nenhuma permissão** e funciona sem rede: está tudo dentro do APK.

Derivado de [Dare Stunts](https://github.com/santosvhs72-design/Dare-Stunts),
que é a versão para browser. Aqui fica só a parte de televisão: o mesmo motor de
jogo, uma interface desenhada para se ver do sofá e conduzir com comando.

## O que tem

- **Três carros** equilibrados para circuitos diferentes — nenhum é melhor, são
  indicados para traçados diferentes.
- **Três pistas** mais as que construíres.
- **Construtor de pistas** que funciona com comando, com validação por
  autopiloto: não deixa guardar uma pista que o carro escolhido não consiga
  terminar.
- **Ghost do recordista**: bate o recorde e essa volta passa a correr contigo na
  vez seguinte, com o intervalo em segundos no HUD. Liga-se e desliga-se a meio
  da volta, e a escolha fica guardada.
- **Recorde global e recorde por carro**: cada pista guarda o melhor tempo de
  sempre e também o melhor de cada um dos três carros, para se poder tentar
  bater a tua própria marca com o Tenaz mesmo que o recorde da pista pertença à
  Lebre. Vê-se tudo em "Ver recordes", no menu da pista (↓).
- **Perfis locais**: a televisão é de todos, os recordes não. Cada perfil tem o
  seu próprio carro escolhido, recordes e fantasmas; o padrão (Piloto 1) usa as
  mesmas chaves de sempre, por isso quem nunca abrir "Perfil" no menu inicial
  nem repara que existe.
- **Aviso de curva**: duas setas por cima do velocímetro, como os piscas de um
  automóvel a sério, acendem para o lado de uma curva que a velocidade actual
  já não permite fazer — quanto mais tarde, mais forte.
- **Céu diferente por pista** — manhã, entardecer, crepúsculo — para cada
  circuito se distinguir dos outros dois já no primeiro segundo, sem ler o
  nome.
- **Ilustração no ecrã inicial** (`img/capa.svg`): desenhada com as cores e as
  formas do próprio jogo, em SVG de 6 KB — nada de imagens pesadas no APK.
- **Cockpit ao estilo de 1990**: painéis planos, mostradores redondos com
  ponteiro e números impressos, e nada de gradientes — porque o Stunts também
  não os tinha.

## Compilar

Precisas do Android Studio (ou do SDK e de um JDK 17+).

```sh
cd androidtv
./sync-assets.sh && ./gradlew assembleDebug
```

O `sync-assets.sh` copia o jogo da raiz do repositório para dentro do APK e
**tem de correr antes de cada build** — o Gradle não sabe que o jogo vive uma
pasta acima. O APK sai em `androidtv/app/build/outputs/apk/debug/`.

Instalar numa TV com depuração ADB ligada:

```sh
adb connect <ip-da-tv>:5555
adb install -r androidtv/app/build/outputs/apk/debug/app-debug.apk
```

Para desenvolver a interface sem compilar nada, serve a raiz por HTTP e abre-a
no browser — é a mesma aplicação (as teclas do comando podem ser simuladas com
`window.__tvKey('down','ArrowDown')`):

```sh
python3 -m http.server 8765
```

## Comandos

Tudo é alcançável **só com a cruzeta, OK e Voltar**, porque muitos telecomandos
de TV não têm mais do que isso. Um comando de jogo ganha atalhos.

| | Telecomando | Comando de jogo |
|---|---|---|
| Navegar | cruzeta | cruzeta ou stick esquerdo |
| Escolher | OK | A |
| Voltar | Voltar | B |
| Opções do item | ↓ | ↓ |
| Pausa | Voltar / Menu | Start |
| Ligar/desligar o ghost | menu de pausa | Y, ou o menu de pausa |
| Ver o que o comando envia | menu inicial &rarr; Comando | idem |
| Trocar ou criar perfil | menu inicial &rarr; Perfil | idem |
| Ver recordes de uma pista | seletor de pistas &rarr; ↓ &rarr; Ver recordes | idem |
| Fechar a aplicação | menu inicial &rarr; Sair, ou Voltar | idem |

A conduzir: RT acelera, LT trava, stick esquerdo vira, A é travão de mão.
Num teclado, `G` liga e desliga o ghost sem parar a volta.

## Como está feito

O jogo corre numa `WebView`, servido de
`https://appassets.androidplatform.net/` e não de `file://` — só o primeiro é um
*contexto seguro*, que os módulos ES e a Gamepad API exigem. A casca nativa trata
do que é mesmo de plataforma: lançador leanback, foco, e as teclas do comando.

Três decisões que não são óbvias e que é bom não desfazer sem saber porquê:

- **A `Activity` intercepta as teclas da cruzeta e entrega-as à página.** A
  `WebView` reporta a cruzeta com `KeyboardEvent.code` vazio (a propriedade
  descreve uma tecla física de teclado, e um telecomando não é um teclado), por
  isso qualquer código escrito contra `code` nunca dispara. E, deixada a si
  mesma, a `WebView` ainda corre a sua própria navegação espacial por cima das
  mesmas teclas, o que leva o foco para fora do documento e deixa a app morta ao
  primeiro toque.
- **O comando pode não ser o primeiro da lista.** Uma televisão Android costuma
  expor o seu próprio telecomando como gamepad, num lugar só dele, e apanhar o
  primeiro que aparece significa sondar o telecomando e ignorar o comando a
  sério. Manda quem foi usado por último (`js/ui/pads.js`). Os botões do comando
  são também reencaminhados pela `Activity` como teclas, para que a `WebView` que
  não exponha a Gamepad API não deixe o comando sem forma de confirmar nada; a
  ação repetida é absorvida pelo limite de 90 ms que já existia.
- **A interface nunca usa o foco do DOM.** Cada ecrã tem o seu próprio cursor e
  reage a ações com nome, o que evita toda uma classe de problemas de foco.
- **Loops e corkscrews são uma volta de uma hélice.** O ligeiro desvio lateral do
  loop é essencial: uma curva plana que dá 360° e volta ao nível tem de se
  intersectar a si própria, e o carro atravessaria a rampa de saída.
- **O primeiro perfil não tem prefixo.** `js/ui/profiles.js` guarda o carro, os
  recordes e os fantasmas de cada perfil em `velocidadecega.<id>.<...>`, exceto
  o primeiro, que fica exactamente onde sempre esteve
  (`velocidadecega.<...>`). Sem essa excepção, instalar esta versão por cima de
  uma anterior faria os recordes já guardados desaparecerem — ficariam à espera
  de um perfil `default` que nunca existiu.
- **O nevoeiro tem de ser a cor do horizonte do céu, não uma cor fixa.** Cada
  pista escolhe um céu (`sky` em `world/tracks.js`); se o nevoeiro não mudasse
  com ele, o sítio onde o cenário se apaga ao longe ficava com uma costura
  visível contra o céu por trás. Por isso `Renderer.fogColor` é um campo da
  instância, escrito de novo em cada `Game.load()` (`skyFogColor()` em
  `world/scenery.js`), e não uma constante fixa como era antes.

O ghost guarda a volta em coordenadas de pista (distância, desvio lateral,
altura e rumo relativos à faixa), não do mundo. Ocupa pouco, interpola sem
solavancos e, reconstruído pelo `track.frameAt()`, assenta exatamente na
superfície onde foi conduzido — de cabeça para baixo dentro de um loop
inclusive.
