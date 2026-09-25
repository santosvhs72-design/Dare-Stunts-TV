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
  bater a tua própria marca com o Slow Hand mesmo que o recorde da pista
  pertença ao Speed King. Vê-se tudo em "Ver recordes", no menu da pista (↓).
- **Perfis locais**: a televisão é de todos, os recordes não. Cada perfil tem o
  seu próprio carro escolhido, recordes e fantasmas; o padrão (Piloto 1) usa as
  mesmas chaves de sempre, por isso quem nunca abrir "Perfil" no menu inicial
  nem repara que existe.
- **Pistas privadas por omissão**: uma pista construída só aparece para quem a
  construiu. O autor decide se a partilha ("Partilhar: sim/não", no menu da
  pista ou no do construtor); partilhada, os outros perfis passam a vê-la numa
  secção "Pistas partilhadas" própria, com o nome de quem a fez — mas só o
  autor a pode editar, apagar ou deixar de partilhar.
- **Reposição da volta**: no ecrã de fim de volta, "Ver reposição" mostra a
  volta acabada de correr vista de fora do carro, com o mesmo fantasma que já
  existia para o recorde -- em vez de o desenhar a par do carro a conduzir,
  a câmara passa a segui-lo. Pausa e sai a qualquer momento; chega ao fim,
  recomeça sozinha.
- **Circuitos e voltas**: uma pista cujo fim volta ao próprio início corre-se
  às voltas (três, por omissão) em vez de de ponta a ponta -- e o construtor
  tem um **"Fechar circuito"** que calcula o troço de ligação sozinho, porque
  fechar um traçado à mão, com peças de raio fixo, não é coisa que se deva
  pedir a ninguém. As pistas que não fecham continuam a ser o percurso de
  sempre. Quantas voltas escolhe-se no menu da pista (↓); o relógio mostra o
  tempo da volta a decorrer por baixo do total, os tempos das voltas já feitas
  ficam à vista com a melhor realçada, e o ecrã de fim de corrida lista-os
  todos. **O recorde de um circuito é a melhor volta**, não a soma: assim não
  depende de quantas voltas foram escolhidas e todos os tempos do quadro
  continuam comparáveis entre si -- e o fantasma guardado é o dessa volta,
  repetido a cada volta que se dá.
- **Luz nos túneis**: um túnel deixa de ser estrada à luz do dia com um tecto
  por cima. A luz do dia esvai-se ao longo dos primeiros metros de bocado, o
  que sobra é a luz quente das lâmpadas da abóbada, e entre lâmpada e lâmpada
  a luz baixa. Não custa um ciclo a mais: o mundo não se mexe e o sol não se
  põe, por isso tudo isto vai cozido nas cores quando a pista é construída.
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
- **Som ao navegar**: um clique curto sempre que o realce muda de item num
  menu ou numa fila — nunca ao conduzir, onde as mesmas teclas viram o volante.

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
| Ver o que o comando envia (e o que a condução faz dele) | menu inicial &rarr; Testar Comando | idem |
| Trocar ou criar perfil | menu inicial &rarr; Perfil | idem |
| Ver recordes de uma pista | seletor de pistas &rarr; ↓ &rarr; Ver recordes | idem |
| Ver a reposição da última volta | ecrã de fim de volta &rarr; Ver reposição | idem |
| Partilhar uma pista tua | seletor de pistas &rarr; ↓ &rarr; Partilhar | idem |
| Ver pistas partilhadas | seletor de pistas &rarr; última pista da fila | idem |
| Fechar a aplicação | menu inicial &rarr; Sair, ou Voltar | idem |

A conduzir: **A acelera, X trava, B é o travão de mão**, stick esquerdo ou
cruzeta vira. Os gatilhos (RT/LT) e cima/baixo da cruzeta também aceleram e
travam, para quem preferir. Y liga e desliga o ghost sem parar a volta, e
Start pausa — a meio de uma volta, B é só o travão de mão e não "voltar", por
isso pausa-se com Start ou com o Voltar do telecomando.
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
  ação repetida é absorvida pelo limite de 90 ms que já existia. E é por aí que
  se conduz numa televisão a sério: os nomes que a `Activity` inventa (`Enter`
  para o A, `KeyX` para o X, `KeyB` para o B) têm de constar também das teclas
  de condução em `game/input.js`, ou o comando vira e acelera mas nunca trava.
  O B tem nome próprio em vez de partilhar o `Escape` do Voltar do telecomando,
  porque a meio de uma volta é o travão de mão -- e um travão de mão que também
  quer dizer "voltar" abre o menu de pausa a meio de uma curva.
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
- **Não há um registo de perfis partilhados — só uma busca.** Uma pista
  partilhada continua guardada só na chave do seu autor
  (`velocidadecega.<id>.tracks`); para as encontrar, `loadShared()`
  (`world/customtracks.js`) percorre todas as chaves `*.tracks` que existem em
  vez de consultar uma lista à parte, a mesma técnica que `js/ui/profiles.js`
  já usa para apagar os dados de um perfil apagado. Menos um sítio onde a
  partilha e o dono se poderiam desincronizar.
- **O nevoeiro tem de ser a cor do horizonte do céu, não uma cor fixa.** Cada
  pista escolhe um céu (`sky` em `world/tracks.js`); se o nevoeiro não mudasse
  com ele, o sítio onde o cenário se apaga ao longe ficava com uma costura
  visível contra o céu por trás. Por isso `Renderer.fogColor` é um campo da
  instância, escrito de novo em cada `Game.load()` (`skyFogColor()` em
  `world/scenery.js`), e não uma constante fixa como era antes.
- **A reposição é o mesmo fantasma, visto de fora em vez de a par do carro.**
  `Game.startReplay()` (`game/game.js`) usa o próprio `GhostPlayer` e o mesmo
  `buildGhostMesh()` do fantasma do recorde -- só a câmara muda, para uma
  posição atrás e acima do carro derivada da orientação gravada, e o modelo
  passa a opaco em vez de translúcido. E o ecrã de reposição
  (`replayView()`, `tv/main.js`) não leva a classe `.modal`: `restack()` já
  escondia o que estivesse por baixo do topo da pilha sempre que esse topo
  não fosse modal, e é exactamente esse comportamento, já ali, que tira o
  fundo escuro do resultado da volta e mostra a pista em vez dele -- sem
  precisar de um caso especial só para isto.
- **Travar tem de custar aderência ao aviso, não só à física.** Travagem e
  curva partilham o mesmo orçamento de atrito (`car.js`): quanto mais forte
  o travão, menos resta para virar, e é por isso que travar tarde demais para
  dentro de uma curva pode fazer o carro fugir em frente mesmo a uma
  velocidade que, a acelerador solto, seria perfeitamente segura. Só que o
  aviso de perda de aderência comparava a curva com o aderência *teórica*
  do pneu (`aLatMax`), não com o que sobrava depois de travar -- por isso o
  carro perdia aderência sem qualquer aviso sempre que a causa era o travão
  e não a velocidade. `this.understeer` agora compara com o mesmo orçamento
  já reduzido (`grip`) que a própria direcção usa para limitar o volante,
  para que o aviso apareça exactamente quando -- e porque -- a aderência
  falha.
- **O travão tem de ser sempre mais forte do que largar o acelerador.** O
  arrasto do ar ao deixar de acelerar (`coastDrag` em `game/cars.js`) cresce
  com o quadrado da velocidade, e à velocidade máxima do Speed King chegava a
  travar *mais* do que o próprio travão a fundo -- o carro mais rápido dos
  três tinha, na prática, o travão mais fraco a sério. Cada carro mantém
  agora o travão a rondar o dobro do arrasto de largar o pé à sua própria
  velocidade máxima, tal como já acontecia (sem se ter pensado nisso) no
  Slow Hand.
- **Travar e acelerar não custam a mesma aderência, porque não põem o peso no
  mesmo sítio.** A travar, o carro mergulha e carrega as rodas que o viram --
  é por isso que se trava para dentro das curvas na vida real. A acelerar,
  senta-se atrás e alivia-as, e o nariz foge em frente. O modelo cobrava aos
  dois o mesmo (`GRIP_SHARE`), o que fazia do travão a pior coisa a tocar
  antes de uma curva: o carro abrandava e seguia em frente na mesma, e
  largar o acelerador dava uma curva melhor do que travar. Agora a travagem
  usa `BRAKE_SHARE`, bastante mais baixo; a subviragem com o pé no
  acelerador fica exactamente como estava.
- **Parar não é limitado pela figura de curva.** `aLatMax` é o que uma ponta
  do carro aguenta de lado; travar são as quatro rodas a puxar para o mesmo
  sítio, num nariz que acabou de mergulhar sobre elas, com o motor a ajudar.
  Cortar o travão a 0,95 da aderência lateral tornava o `brake` de cada carro
  letra morta — todos travavam ao que a borracha deles desse, e as barras de
  "Travagem" não queriam dizer nada. O corte passou para `BRAKE_GRIP` (1.35),
  acima do que qualquer carro pede, e cada carro tem o seu número: 16 / 18,5 /
  21 m/s², pela mesma ordem das barras. O corte continua a morder onde a
  aderência de facto desapareceu: na berma, e no alto de uma lomba onde não há
  peso nenhum nas rodas. Travar de 200 para 80 km/h passou de uma eternidade
  para 59 m no Speed King, contra 330 m só a largar o acelerador.
- **O arrasto do ar não se desliga por se carregar no travão.** O termo de
  resistência só corria com *os dois pedais soltos*, por isso tocar no travão
  fazia perder a travagem do motor e do ar que se tinha só por largar o pé --
  e é precisamente essa a parte que cresce com a velocidade. A fricção dos
  travões é igual a qualquer velocidade e sozinha tira velocidade em linha
  reta, o que faz o primeiro instante de uma travagem do topo da sexta
  parecer que não acontece nada. Agora a condição é o acelerador estar
  fechado, e com o nariz em travagem o ar conta `BRAKE_DRAG` vezes mais: o
  Speed King tira 26 km/h no primeiro quarto de segundo a 274 km/h, e vai
  aliviando à medida que abranda. O travão também ganha ao acelerador quando
  os dois estão premidos, como em qualquer carro deste século — com um
  comando o acelerador é um botão que se segura por hábito, e deixá-lo
  empurrar contra o travão comia um terço da travagem.

- **Num circuito só a geometria dá a volta, a distância não.** O carro conta
  metros para cima do princípio ao fim da corrida e nunca volta a zero; é o
  `frameAt()` (`world/track.js`) que faz a distância dar a volta por dentro,
  e devolve-a outra vez somada à volta em que ia. Assim tudo o que conta
  distância -- o fantasma, os checkpoints, o contador de voltas -- continua a
  poder assumir que ela só cresce, que é como está escrito. Fechar ou não
  fechar é **medido**, não declarado: compara-se o fim com o princípio, com
  tolerâncias apertadas porque a costura é atravessada a alta velocidade e
  meio metro de desacordo já é um solavanco.
- **O troço que fecha o circuito é proposto e depois verificado.** A
  geometria em `editor/close.js` é só um palpite: o construtor anda a pista
  em passos de um metro e roda antes de avançar, por isso a estrada que ele
  assenta nunca é exactamente o arco que a álgebra desenhou, e ao fim de uns
  quilómetros isso são metros. Em vez de modelar essa diferença, mede-se --
  cada candidato é andado com o construtor a sério e afinado por Newton
  contra o erro medido, e só volta um que feche de facto.

- **A luz que não muda não se calcula sessenta vezes por segundo.** É o
  princípio por trás da luz dos túneis e da sombra da pista no chão
  (`world/track.js`): o mundo é estático e a iluminação é por vértice, por
  isso o que não varia pode ser misturado nas cores dos vértices enquanto a
  pista se constrói, e a partir daí não custa nada. É o que a torna possível
  numa televisão que não aguentou uma única luz por pixel a mais.
- **A sombra é desenhada mais larga do que a estrada, de propósito.** O sol
  está a 55° de altura, o que dá dois terços de metro de inclinação por cada
  metro de altura, e a faixa de rodagem tem treze metros de largura: uma
  sombra da largura da estrada passaria a pista inteira escondida debaixo dela
  e só apareceria ao lado de um viaduto. A largura a mais aparece dos dois
  lados como relva mais escura -- o sombreado que uma coisa apanha por estar
  perto do chão -- e é isso que faz a estrada parecer pousada no mundo.
- **Os cruzamentos são medidos com a largura verdadeira da estrada.** Rails
  incluídos, treze metros e meio, e não os onze que antes se usavam -- entre
  um número e o outro cabem sobreposições que ninguém quer ver. Passar por
  cima ou por baixo continua a ser legítimo; o que conta como choque é estar
  perto em planta *e* perto em altura (`crossings()` em `world/track.js`, usado
  tanto pelo fecho de circuitos como pelo aviso no construtor). E um pilar que
  fosse descer através de outra estrada deixa de ser construído: não ter nada a
  segurar o viaduto ali fica melhor do que uma coluna no meio da faixa.
- **`world/track.js` e `world/scenery.js` importam-se um ao outro.** O ciclo é
  seguro porque nenhum lê o valor do outro enquanto o módulo está a ser
  avaliado -- `GROUND_Y` só é lido dentro de `buildShadow()`, muito depois --
  mas é bom saber que lá está antes de mover constantes entre os dois.

O ghost guarda a volta em coordenadas de pista (distância, desvio lateral,
altura e rumo relativos à faixa), não do mundo. Ocupa pouco, interpola sem
solavancos e, reconstruído pelo `track.frameAt()`, assenta exatamente na
superfície onde foi conduzido — de cabeça para baixo dentro de um loop
inclusive.
