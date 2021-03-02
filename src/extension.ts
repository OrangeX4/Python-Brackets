// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('python-brackets.nest', () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) { return }
        const doc = editor.document
        const pos = editor.selection.start
        const text = doc.getText(new vscode.Range(new vscode.Position(pos.line, 0), pos))

        // State machine, get the funcName and nestedText
        let curr = pos.character
        let pre = curr
        let ch = ''
        let state = 'FUNC'

        // Value
        let bracketsCount = 0
        let funcName = ''
        let nestedText = ''

        function eat() {
            if (curr > 0) {
                curr--
                return text[curr]
            } else {
                return ''
            }
        }

        while (ch = eat()) {
            if (state === 'END') {
                break
            }
            switch (state) {
                case 'FUNC':
                    if (ch === ':') {
                        funcName = text.substr(curr + 1, pre - curr)
                        pre = curr
                        state = 'TEXT'
                    }
                    break

                case 'TEXT':
                    if (ch === ')') {
                        bracketsCount++
                    } else if (ch === '(') {
                        bracketsCount--
                    }

                    if (bracketsCount > 0) {
                        state = 'BRACKET'
                    } else if (bracketsCount < 0) {
                        state = 'END'
                    }

                    if (ch === ' ' || ch === '\t' || ch === '') {
                        state = 'END'
                    }
                    break

                case 'BRACKET':
                    if (ch === ')') {
                        bracketsCount++
                    } else if (ch === '(') {
                        bracketsCount--
                    }

                    if (bracketsCount <= 0) {
                        state = 'TEXT'
                    }
                    break

                default:
                    state = 'END'
            }
        }

        if (state === 'END') {
            curr += 2
            nestedText = text.substr(curr, pre - curr)
        } else {
            nestedText = text.substr(curr, pre - curr)

        }

        // Replace text
        if (funcName) {
            editor.edit((edit) => {
                let range = new vscode.Range(new vscode.Position(pos.line, curr), pos)
                edit.replace(range, `${funcName}(${nestedText})`)
            }).then(() => {
                if (!editor) { return }
                editor.selections = [new vscode.Selection(editor.selection.end, editor.selection.end)]
            })
        }

    })

    context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate() { }
