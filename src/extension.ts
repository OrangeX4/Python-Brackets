// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  context.subscriptions.push(vscode.commands.registerCommand('python-brackets.nest', () => {
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
    let isOverflow = false

    // Value
    let bracketsCount = 0
    let funcName = ''
    let nestedText = ''

    function eat() {
      if (curr > 0) {
        curr--
        return text[curr]
      } else {
        isOverflow = true
        return ''
      }
    }

    while (ch = eat()) {
      if (state === 'TEXTEND' || state === 'BRACKETEND' || state === 'END') {
        break
      }
      switch (state) {
        case 'FUNC':
          if (ch === ':') {
            funcName = text.substr(curr + 1, pre - curr)
            pre = curr
            state = 'BEGIN'
          }
          break

        case 'BEGIN':
          if (ch === '}') {
            bracketsCount++
            state = 'DICT'
          } else if (ch === ']') {
            bracketsCount++
            state = 'LIST'
          } else if (ch === ')') {
            bracketsCount++
            state = 'BRACKET'
          } else if (ch === '\'') {
            state = 'SINGLE'
          } else if (ch === '"') {
            state = 'DOUBLE'
          } else {
            state = 'TEXT'
          }
          break

        case 'SINGLE':
          if (ch === '\'') {
            state = 'TEXT'
          }
          break

        case 'DOUBLE':
          if (ch === '"') {
            state = 'TEXT'
          }
          break

        case 'LIST':
          if (ch === ']') {
            bracketsCount++
          } else if (ch === '[') {
            bracketsCount--
          }
          if (bracketsCount <= 0) {
            state = 'TEXT'
          }
          break

        case 'DICT':
          if (ch === ']') {
            bracketsCount++
          } else if (ch === '[') {
            bracketsCount--
          }
          if (bracketsCount <= 0) {
            state = 'BRACKETEND'
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

        case 'TEXT':
          if (ch === ')') {
            bracketsCount++
            state = 'BRACKET'
          } else if (ch === ']') {
            bracketsCount++
            state = 'LIST'
          } else if (ch === '\'') {
            state = 'SINGLE'
          } else if (ch === '"') {
            state = 'DOUBLE'
          } else if (ch === ' ' || ch === '\t' || ch === '' || ch === '(' || ch === '[' || ch === '{') {
            state = 'TEXTEND'
          }
          break

        default:
          state = 'END'
      }
    }

    if (state === 'TEXTEND') {
      if (isOverflow) {
        curr += 1
      } else {
        curr += 2
      }
      nestedText = text.substr(curr, pre - curr)
    } else if (state === 'BRACKETEND') {
      if (text[curr] !== '[' && text[curr] !== '{') {
        curr += 1
      }
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

  }))

  function findBracket() {
    const closerMap: any = { '(': ')', '[': ']', '{': '}', '<': '>', ')': '(', ']': '[', '}': '{', '>': '<' }
    const directionMap: any = { '(': 1, '[': 1, '{': 1, '<': 1, ')': -1, ']': -1, '}': -1, '>': -1 }

    const editor = vscode.window.activeTextEditor
    if (!editor) { return }
    const doc = editor.document
    const pos = editor.selection.start
    const text = doc.lineAt(pos.line).text

    // State machine, get the funcName and nestedText
    let length = text.length
    let curr = pos.character
    let start = curr
    let end = null
    let ch = ''
    let count = 1

    // 起始符
    const opener = text[curr - 1]
    if (!(opener in closerMap)) {
      return
    }

    // 闭合符与自增方向
    const closer = closerMap[opener]
    const direction = directionMap[opener]
    curr--

    function eat() {
      if (curr >= 0 && curr <= length) {
        curr += direction
        return text[curr]
      } else {
        // isOverflow = true
        return ''
      }
    }

    let isEnd = false
    while (ch = eat()) {
      if (isEnd) {
        break
      }
      switch (ch) {
        // 闭合符
        case closer:
          count--
          if (count === 0) {
            end = curr
            isEnd = true
          }
          break
        // 开启符
        case opener:
          count++
          break
        default:
      }
    }

    return { pos, text, opener, closer, direction, start, end }
  }

  function buildRange(line: number, start: number, end: number) {
    return new vscode.Range(new vscode.Position(line, start), new vscode.Position(line, end))
  }

  function buildSelection(line: number, start: number, end: number) {
    return new vscode.Selection(new vscode.Position(line, start), new vscode.Position(line, end))
  }

  context.subscriptions.push(vscode.commands.registerCommand('python-brackets.remove', () => {

    const editor = vscode.window.activeTextEditor
    if (!editor) { return }

    const result = findBracket()
    if (!result) {
      return
    }
    const { pos, text, start, end, direction } = result

    if (end !== null) {
      editor.edit((edit) => {
        if (direction === 1) {
          edit.replace(buildRange(pos.line, start - 1, end + 1), text.substr(start, end - start))
        } else if (direction === -1) {
          edit.replace(buildRange(pos.line, start, end), text.substr(end + 1, start - end - 2))
        }
      })
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand('python-brackets.selectLeft', () => {

    const editor = vscode.window.activeTextEditor
    if (!editor) { return }

    const result = findBracket()
    if (!result) {
      return
    }
    const { pos, text, start, end, direction } = result

    if (end !== null) {
      editor.edit((edit) => {
        if (direction === 1) {
          editor.selection = buildSelection(pos.line, start - 1, end + 1)
        } else if (direction === -1) {
          editor.selection = buildSelection(pos.line, start, end)
        }
      })
    }
  }))

}

// this method is called when your extension is deactivated
export function deactivate() { }
