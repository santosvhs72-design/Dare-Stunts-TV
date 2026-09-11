# A casca Android TV

(Visão geral do projeto: [README na raiz](../README.md).)

App nativa para Android TV. O **jogo é exatamente o mesmo** da versão web: a
física, o render WebGL, o cockpit e o som são os mesmos ficheiros, sem uma
linha diferente. O que muda é só a interface à volta — porque só a interface
estava errada numa televisão.

## Porque é que o jogo corre numa WebView

Reescrever o motor em Kotlin/OpenGL daria um jogo *parecido*, não o mesmo: o
comportamento do carro sairia inevitavelmente diferente. Como o requisito era
manter o jogo igual, a casca nativa hospeda o jogo tal como está e trata do
que é genuinamente de plataforma — lançador, foco, botões do comando.

Os ficheiros são servidos de `https://appassets.androidplatform.net/` e não de
`file://`, porque só o primeiro é um *contexto seguro*, que os módulos ES do
jogo e a Gamepad API exigem. Nada vem da rede: está tudo dentro do APK e a app
**não pede nenhuma permissão**.

Os recordes e as pistas criadas vivem em `localStorage`, partilhado com a
versão web servida da mesma pasta — uma pista feita na TV aparece no browser e
vice-versa.

## Estrutura

```
androidtv/              esta app
  app/src/main/assets/  o jogo, copiado por sync-assets.sh (não editar aqui)
../tv.html              a interface de TV        <- ponto de entrada da app
../js/tv/               ecrãs, editor, teclado, input, mapa
../css/tv.css           interface de 10 pés
../index.html           a versão web, intocada
```

## Compilar

```sh
./sync-assets.sh && ./gradlew assembleDebug
```

O `sync-assets.sh` **tem de correr antes de cada build** — o Gradle não sabe
que o jogo vive na pasta acima. O APK sai em
`app/build/outputs/apk/debug/app-debug.apk`.

Instalar na TV (com depuração ADB ligada):

```sh
adb connect <ip-da-tv>:5555
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Comandos

Tudo é alcançável **só com a cruzeta, OK e Voltar**, porque muitos comandos de
TV não têm mais do que isso. Quem tiver um comando de jogo ganha atalhos.

| | Comando de TV | Comando de jogo |
|---|---|---|
| Navegar | cruzeta | cruzeta ou stick esquerdo |
| Escolher | OK | A |
| Voltar | Voltar | B |
| Opções do item | ↓ | ↓ |
| Pausa na corrida | Voltar / Menu | Start |

A condução mantém o esquema do jogo: RT acelera, LT trava, stick esquerdo vira,
A é travão de mão.

## O ghost do recordista

Quando bates o recorde de uma pista, essa volta fica gravada e passa a correr
contigo na vez seguinte: um carro translúcido, na cor do modelo que fez o tempo,
mais o intervalo em segundos por baixo do relógio (verde à frente, vermelho
atrás). Só a volta do recorde é guardada — bater o recorde substitui-a.

A volta é guardada em **coordenadas de pista** (distância percorrida, desvio
lateral, altura e rumo relativos à faixa), não em coordenadas do mundo. Assim
ocupa pouco (45–100 KB por pista), interpola sem solavancos, e reconstruída
através de `track.frameAt()` assenta exatamente na superfície onde foi
conduzida — de cabeça para baixo dentro de um loop inclusive. Cada amostra
guarda também o avanço em frente, que é zero em estrada mas é o salto inteiro no
ar, onde a distância percorrida fica presa à rampa de onde o carro saiu.

Precisou de três peças que o motor não tinha: um modelo 3D do carro (o jogo é só
primeira pessoa e nunca precisou de um), uma matriz de modelo no renderer e
transparência. Nada disto altera o que já existia: sem ghost, desenha-se
exatamente como antes.

**A versão web grava as voltas mas nunca as mostra** — assim um recorde feito no
browser é corrível na TV, e o jogo de secretária fica exatamente como estava.

## O editor com comando

O editor da versão web é uma ferramenta de rato — paleta, sliders, listas
clicáveis — e nada disso sobrevive a uma cruzeta. Este é construído ao
contrário: a pista é uma **fita de peças** que se percorre com esquerda/direita,
e cada ação é um botão cujo significado está sempre escrito no rodapé.

- **←/→** percorrer as peças
- **↓** abre as opções da peça (adicionar, ajustar, apagar, mover, menu)
- **A** adicionar peça · **Y** ajustar · **X** apagar · **LB/RB** mover

Ajustar uma peça é uma lista onde ↑/↓ escolhe o parâmetro e ←/→ altera o valor
— que é precisamente o que uma cruzeta faz bem. O mapa atualiza em direto.

Guardar corre o **autopiloto** com o carro escolhido e recusa pistas que ele não
consiga terminar, tal como na versão web. O nome escreve-se num teclado no ecrã
próprio, em vez do teclado do sistema: a app intercepta as teclas da cruzeta
antes de a página as ver, e o IME do Android disputaria as mesmas teclas.
