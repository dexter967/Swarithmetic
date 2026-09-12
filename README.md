<img width="1280" height="640" alt="image" src="https://github.com/user-attachments/assets/18a7a512-68da-4311-b811-778685936a55" />
SWARITHMETIC 🎯
 
 Our landing page: https://dexter967.github.io/Swarithmetic/landing.html


Basic Details

Team Name: DUMBALISCIOUS


Team Members

Team Lead: Abhijith A Kurup - College Of Engineering Chengannur

Member 2: Akshada V - College Of Engineering Chengannur
Project Description
A calculator that calculates through swaram

The Problem (that doesn't exist)


The Solution (that nobody asked for)
[How are you solving it? Keep it fun!]

Technical Details
Technologies/Components Used
For Software:

Language used : HTML,CSS,Javascript
**Frameworks used:** None


**Libraries used:** GSAP, ScrollTrigger, MotionPathPlugin, Web Audio API


**Tools used:** PowerShell, `apply_patch`, `Compress-Archive` (ZIP packaging)

Implementation
For Software:
## Installation


No package installation is required.


Download and extract:


PowerShell






```
Expand-Archive .\swarithmetic-game.zip -DestinationPath .\swarithmetic-game
Set-Location .\swarithmetic-game

```





The project contains:


Plain text






```
index.html
index-new.html
style.css
script.js
luttapi.png
wall.jpg

```





## Run


Because microphone access requires a secure browser context, run a local web server.


### Python


PowerShell






```
python -m http.server 8000

```





Open:


Plain text






```
http://localhost:8000/index.html

```





### Node.js alternative


PowerShell






```
npx serve .

```





Open the URL displayed in the terminal.


Allow microphone permission when prompted. HTTPS or `localhost` is required for pitch detection.


## Project Documentation


### Main files




































| File | Description |
| --- | --- |
| `index.html` | Main application page and game markup |
| `index-new.html` | Synchronized refreshed HTML copy |
| `style.css` | Landing page, calculator, game, animations, pitch meter, and themes |
| `script.js` | Arithmetic logic, microphone pitch detection, game movement, barriers, themes, and result handling |
| `luttapi.png` | Player character image |
| `wall.jpg` | Game wall/background artwork |



### Features



- Music-themed arithmetic calculator

- Addition, subtraction, multiplication, and division

- Operator-specific color themes

- Microphone-based pitch detection

- Fixed 0–1000 Hz pitch meter

- Visible target pitch line for every swara

- Smooth pitch tracking and matching

- Luttapi obstacle game

- Three animated barriers

- Swara labels on obstacles

- Final arithmetic result animation

- Responsive full-screen game layout

- Animated musical landing page



### Controls



1. Select the first number.

2. Select an operator.

3. Select the second number.

4. Press **Calculate**.

5. Allow microphone access.

6. Sing or play the displayed swara pitch.

7. Match the target line in the pitch meter.

8. Pass all barriers to reveal the result.



### Technologies



- HTML5

- CSS3

- JavaScript

- Web Audio API

- GSAP

- ScrollTrigger

- MotionPathPlugin

- CDN-hosted Google Fonts



No backend or database is required.
Project Documentation
For Software:

Screenshots (Add at least 3)
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/d98b0891-6e8f-447c-8f59-da88f98aa858" /> this is our front page 


<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/d6cf6b8c-8841-478d-9bf1-3c9e899c5501" /> our calculator

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/05bb8e82-8a21-4a08-9301-bfac4a0311c4" /> this is our result 


Diagramsflowchart LR
    A[Calculator Page] --> B[Select First Number]
    B --> C[Select Operator]
    C --> D[Select Second Number]
    D --> E[Press Calculate]
    E --> F[Start Microphone Pitch Detection]
    F --> G[Display Swara Target]
    G --> H{Pitch Matches Target?}
    H -- No --> G
    H -- Yes --> I[Move Luttapi Through Barrier]
    I --> J{More Barriers?}
    J -- Yes --> G
    J -- No --> K[Luttapi Flies to Finish]
    K --> L[Display Arithmetic Result]


Project Demo
(https://drive.google.com/file/d/1_B6_gLas7QoPHvO4eC1hepwbQkcM4MVB/view?pli=1)


Team Contributions
Abhijith A Kurup: Worked alongside on development, implementation, testing, debugging and bringing the game idea into a working prototype.
The project was not built in perfectly separated boxes. We jumped between tasks, helped each other debug problems and continuously tested the game as it evolved.
Akshada V:Worked on the project concept, interface design, frontend development, game flow and documentation. Also participated in testing and debugging the different parts of the game.



Made with ❤️ at TinkerHub Useless Projects
