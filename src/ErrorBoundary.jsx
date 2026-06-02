import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] 捕获异常:', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>😵 出错了</h2>
          <p>请刷新页面重试。如果问题持续，检查控制台（F12）查看完整错误信息。</p>
          <pre>{this.state.error?.message}</pre>
          <button onClick={this.handleReset}>重试</button>
        </div>
      )
    }
    return this.props.children
  }
}
