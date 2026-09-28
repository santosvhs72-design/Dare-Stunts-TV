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
- **A linha conta**: por dentro é mais curto mas mais apertado, por fora é mais
  largo mas mais longo, e uma curva bem feita guarda velocidade que uma curva
  atirada perde. Entrada e saída passam a ser decisões, não decoração.
- **Um carro que se conduz com as duas pontas**: trava-se para dentro das
  curvas, foge em frente se lhe der força a mais à saída, e a traseira vem à
  frente se largar o pé a meio. Nada disso é um truque programado — é o peso a
  passar de um eixo para o outro, que é o que faz um carro comportar-se como um
  carro. Com caixa de velocidades que se sente, e o corpo a inclinar-se, a
  mergulhar e a assentar nas molas por cima de tudo isso.
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
  não os tinha. Ao volante vê-se o capô com o vinco a meio, os espelhos
  retrovisores nas asas, as escovas do limpa-vidros paradas contra o capô e as
  portas a fechar os cantos de baixo — tudo modelado em metros e projetado pela
  mesma câmara que desenha a estrada, não desenhado por cima dela.
- **Um carro a sério visto de fora**: o fantasma do recordista e a reposição da
  volta deixaram de ser oito caixas. O corpo é feito de secções ao longo do
  comprimento, estreitando para os dois extremos, com tejadilho, vidros, jantes,
  farolins, asa traseira e a risca da casa — e cada carro no seu tom.
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
  ação repetida é absorvida pelo guarda descrito abaixo. E é por aí que
  se conduz numa televisão a sério: os nomes que a `Activity` inventa (`Enter`
  para o A, `KeyX` para o X, `KeyB` para o B) têm de constar também das teclas
  de condução em `game/input.js`, ou o comando vira e acelera mas nunca trava.
  O B tem nome próprio em vez de partilhar o `Escape` do Voltar do telecomando,
  porque a meio de uma volta é o travão de mão -- e um travão de mão que também
  quer dizer "voltar" abre o menu de pausa a meio de uma curva.
- **A interface nunca usa o foco do DOM.** Cada ecrã tem o seu próprio cursor e
  reage a ações com nome, o que evita toda uma classe de problemas de foco. Tem
  um preço: o browser não rola atrás de uma classe como rolaria atrás do foco,
  por isso é `keepVisible()` (`js/tv/main.js`) que traz a seleção para dentro do
  painel a cada ação — uma vez só, no ponto por onde todas passam.
- **Um botão que já estava carregado não é uma pressão nova.** Acaba-se uma
  volta com o acelerador a fundo e o menu de resultados aparece por baixo do
  mesmo polegar: se essa pressão contar, o menu escolhe-se sozinho. O problema
  não é a repetição em si, é que cada aparelho a conta de maneira diferente — o
  Android repete `ACTION_DOWN` sem parar, há comandos que repetem como pares
  cima/baixo, e o gamepad não tem transições nenhumas, lê-se por nível. Por isso
  `js/tv/input.js` não confia em nenhuma delas: guarda quando cada pressão
  *começou* (a primeira menção depois de um silêncio, ou depois de um largar
  com mais de 60 ms), e `restack()` marca o instante em que o ecrã mudou. Uma
  ação cuja pressão começou antes do ecrã atual não dispara. As direções estão
  de fora — manter uma carregada para percorrer uma lista é para isso que serve.
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
- **O que está mesmo à frente do vidro não se desenha por cima do vidro.** O
  cockpit (`game/hud.js`) é um modelo em metros com o olho na origem, projetado
  pelo mesmo buraco de alfinete que a câmara usa -- por isso o capô foge para o
  mesmo ponto de fuga que a estrada e apanha a luz pela mesma conta. Foi isso
  que tornou barato dar-lhe forma: um vinco a meio custa três faces e o resto
  fá-lo a luz; as escovas do limpa-vidros aparecem recortadas contra o capô
  porque é ali que a geometria as põe, não porque alguém as tenha lá posto; e os
  espelhos desenham-se *antes* do capô, para que o capô tape o pé de cada haste
  -- em Canvas 2D não há profundidade nenhuma para o fazer sozinha.
- **Uma caixa não tem forma nenhuma para a luz encontrar.** O carro visto de
  fora era oito caixas alinhadas com os eixos, e o problema não era o número de
  triângulos -- um carro não é nada ao lado de um quilómetro de estrada -- era
  que cada face estava virada exactamente como uma face do mundo, e o conjunto
  lia-se como bagagem. `game/carmesh.js` constrói o corpo por secções ao longo
  do comprimento, cada uma com o ombro chanfrado, unidas face a face: continua
  tudo plano, como o resto do mundo, mas as faces apontam para lados suficientes
  para o mesmo shader que ilumina a pista distinguir um capô de uma ilharga sem
  que ninguém lho diga.
- **O ambiente é um chão de luz, não um nível.** A reposição desenhava o carro
  com `uAmbient = 1`, o que no shader quer dizer *sem sombreado nenhum*: com as
  oito caixas ainda passava, porque cada caixa já vinha com as faces escurecidas
  à mão, mas apagava por completo a forma de um corpo que conta com a luz. Agora
  vai a 0.5, como o resto da imagem.
- **A reposição é o mesmo fantasma, visto de fora em vez de a par do carro.**
  `Game.startReplay()` (`game/game.js`) usa o próprio `GhostPlayer` e o mesmo
  modelo do fantasma do recorde -- só a câmara muda, para uma
  posição atrás e acima do carro derivada da orientação gravada, e o modelo
  passa a opaco em vez de translúcido, e com a pintura do carro em vez de um
  só tom (um fantasma é de outra pessoa e tem de se ler como tal ao relance). E o ecrã de reposição
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
  falha. `grip` é hoje o menor dos dois eixos: é o que o carro aguenta em
  equilíbrio, e qual deles é o menor *é* a diferença entre subvirar e
  sobrevirar.
- **O travão tem de ser sempre mais forte do que largar o acelerador.** O
  arrasto do ar ao deixar de acelerar (`coastDrag` em `game/cars.js`) cresce
  com o quadrado da velocidade, e à velocidade máxima do Speed King chegava a
  travar *mais* do que o próprio travão a fundo -- o carro mais rápido dos
  três tinha, na prática, o travão mais fraco a sério. Cada carro mantém
  agora o travão a rondar o dobro do arrasto de largar o pé à sua própria
  velocidade máxima, tal como já acontecia (sem se ter pensado nisso) no
  Slow Hand.
- **Distância de pista não é distância de estrada, e era por isso que a linha
  não valia nada.** O carro conta metros ao longo do eixo da pista. Quem vai
  por dentro de uma curva anda à volta de um círculo mais pequeno do que o
  eixo, portanto cada metro que percorre vale mais do que um metro de pista;
  quem vai por fora, menos. A razão é `1 - u·k` -- o desvio vezes a curvatura
  -- e sem ela, que não lá estava, o interior e o exterior de todas as curvas
  do jogo mediam exactamente o mesmo. Não se ganhava nada por encostar ao lado
  de dentro nem se perdia nada por abrir: medido, uma volta encostado por
  dentro, pelo meio e por fora dava o mesmo ao décimo. Hoje são 0,9 s de
  diferença na Costa Verde e 2,6 s no Circuito Vertigem.
  A mesma razão faz as duas metades do negócio. É quanta pista o carro cobre, e
  é a que velocidade a estrada roda por baixo dele -- portanto a linha de
  dentro, sendo mais curta, é também mais apertada, e tem de ser feita mais
  devagar. Qual das duas ganha é assunto da curva, e de quem conduz.
- **E fazer uma curva custa velocidade mesmo sem escorregar nada.** Um pneu só
  faz força de lado se andar a um ângulo de onde vai, sejam sete graus a
  fundo ou menos abaixo disso, por isso parte da força que faz aponta para
  trás. É por isso que um carro abranda numa curva longa com o acelerador
  preso, e é a outra metade -- a mais importante -- de porque é que vale a pena
  escolher uma linha: a primeira metade só diz que por dentro é mais curto, o
  que sozinho faria da berma a resposta a todas as curvas. Esta diz que uma
  linha mais direita guarda mais da velocidade com que chegou, e é isso que
  transforma a entrada e a saída em decisões. Custa 0,5% do tempo de volta e
  não trouxe um único despiste.
- **Um carro tem duas pontas, e é isso que o deixa rodar.** Durante muito
  tempo houve um só orçamento de atrito para o carro inteiro. Um orçamento só
  pode estar gasto ou não estar: dá subviragem, dá um deslizar de lado do
  corpo todo, e nunca dá uma rotação, porque não há nada lá dentro que saiba
  distinguir a ponta que vira da ponta que puxa. Todas as curvas acabavam da
  mesma maneira -- acabou a aderência, o nariz foge -- e o travão de mão
  precisava de um caso especial só para produzir a única coisa que o modelo
  não sabia fazer.
  Agora a carga divide-se, e a conta toda é `h/L`: cada metro por segundo ao
  quadrado de aceleração passa essa fracção do peso de um eixo para o outro
  (`CG_H`, `WEIGHT_F`, `BRAKE_BIAS` em `game/car.js`). Tudo o que um condutor
  reconhece sai daí sem ter sido pedido. A travar, o peso vai para as rodas
  que viram e o carro entra na curva -- e tira-o de trás, por isso travar
  tarde traz a traseira. A acelerar, carrega as que puxam e alivia as que
  viram, e o nariz foge em frente; com força a mais numa saída lenta, a
  traseira vai à vida. Largar o pé a meio de uma curva devolve nariz e tira
  cauda, e o carro roda. Nada disto está escrito em lado nenhum: são dois
  eixos, duas cargas e a mesma figura de atrito aplicada a cada um.
- **O volante limita-se pelo eixo da frente, não pelo mais fraco dos dois.**
  A primeira versão disto media a direcção pela ponta com menos aderência, o
  que parecia prudente e era um desastre: numa travagem a fundo a traseira é
  sempre a mais fraca -- tem o nariz a levar-lhe o peso todo -- e o carro
  simplesmente recusava-se a virar, que é exactamente a queixa que a travagem
  já tinha tido antes. O que limita o quanto vale a pena rodar um volante é a
  aderência das rodas que estão a ser rodadas. Se a traseira não acompanhar,
  o que tem de acontecer é a traseira vir à frente.
- **E a transferência é limitada pelo que os pneus conseguem empurrar.** O
  travão é de propósito mais forte do que a figura de curva (ver `BRAKE_GRIP`
  abaixo). Sem um limite, essa licença virava peso que o carro não tem: uma
  travagem a 1,9 g atirava metade da carga para fora do eixo de trás e não
  havia direcção nenhuma. A transferência usa a desaceleração que a borracha
  daria, não a que o travão dá.
- **A caixa de velocidades passou a sentir-se, não só a ouvir-se.** As
  rotações sempre subiram e caíram a cada mudança para o som do motor,
  enquanto o carro continuava a puxar por tudo isso como se tivesse uma única
  mudança infinitamente longa. Duas coisas mudam isso e nenhuma delas pode
  tornar o carro mais rápido ou mais lento: uma curva de binário, melhor um
  pouco antes do limitador e mais mole nas duas pontas, e a própria mudança,
  que é um buraco a sério no arrasto em vez de um número. A escala da curva
  não foi escolhida a olho -- é a que põe a aceleração de 0 a 150 do carro com
  caixa em cima da do carro sem ela, com a diferença a caber num décimo de
  segundo.
- **A queda de rotações estava errada, e era ela que fazia o motor soar a
  sirene.** `gearFor` esticava a banda de cada mudança pela mesma varredura
  completa, portanto todas as mudanças davam a mesma queda enorme e o motor
  recomeçava do fundo seis vezes a caminho da velocidade máxima. Numa caixa a
  sério a rotação é a velocidade a dividir pela mudança, e a mudança está
  escolhida para o limitador cair no topo da banda: de primeira para segunda a
  agulha cai para três quintos, de quinta para sexta quase não se mexe. É uma
  linha de código e é a diferença entre um motor e um alarme.
- **Um salto não é um castigo.** Ao aterrar, a parte vertical do voo desaparece
  sozinha — projeta-se a velocidade no plano da estrada, que é o mesmo que dizer
  que foi para o chão. O que sobra é o arrastar de aterrar mal, e esse era
  enorme: um salto normal devolvia o carro um terço mais lento do que descolou,
  o que fazia de cada rampa de cada pista uma penalização em vez de um número do
  programa. Hoje custa menos de 10%, e uma chegada violenta à saída de um loop
  fica pelos 20% do topo (`land()`, `js/game/car.js`).
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

- **O carro assenta nas molas, e é aí que mora quase toda a sensação.** Nada
  disto muda para onde o carro vai: é o corpo a inclinar-se por cima de um
  caminho que já está decidido, e são três passos de mola por imagem, não
  quatro rodas. Mas uma vista que nunca se inclina numa curva, nunca mergulha
  a travar e nunca aterra em lado nenhum é uma câmara num carril, e nenhum
  modelo de pneu por baixo dela alguma vez se vai ler como conduzir. São 3,6°
  de inclinação a 1,2 g, 3° de mergulho numa travagem a fundo, o corpo a subir
  seis centímetros no ar e a assentar três ao chegar, e o lancil a chocalhar.
- **O corpo aplica-se *depois* da suavização, e a versão suavizada guarda-se à
  parte.** Escrever a inclinação por cima do valor que a suavização vai ler na
  imagem seguinte é dá-la a si própria: só um quinto sai por imagem e o resto
  acumula. Três graus de inclinação do corpo chegavam ao ecrã como dezasseis e
  o horizonte caía ao chão em cada curva. Por isso `_camQ`/`_camP` (o chassis
  suavizado) são campos distintos de `camQuat`/`camPos` (o que a câmara usa).
- **O chocalhar do lancil vai por cima das molas, não por dentro.** Uma
  suspensão a 2 Hz engole um chocalhar inteiro, que é precisamente a função
  dela num carro a sério e precisamente o resultado errado aqui. E os frisos
  contam-se por metro e não por segundo -- para o chocalhar subir com a
  velocidade, como o verdadeiro -- mas a um espaçamento que nenhum lancil tem:
  três frisos por metro são oitenta hertz a andar, e isso não é coisa que uma
  imagem a sessenta por segundo consiga mostrar.
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
