@echo off
REM Sobe o sistema visivel para a rede local, para mandar o link a outra pessoa.
REM Para uso so nesta maquina, rode "python app.py" normalmente.
cd /d "%~dp0"
set LIMBO_HOST=0.0.0.0
echo.
echo  Subindo o Clientes Limbo para a rede local...
echo  Copie o link "Mande este link" abaixo e envie ao seu gestor.
echo  Feche esta janela (ou Ctrl+C) para tirar do ar.
echo.
python app.py
pause
