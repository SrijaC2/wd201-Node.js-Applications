const request = require('supertest')
const cheerio = require('cheerio')
const db = require('../models/index')
const app = require('../app')

let server, agent
function extractCsrfToken (res) {
  const $ = cheerio.load(res.text)
  return $('[name=_csrf]').val()
}

const login = async (agent, username, password) => {
  let res = await agent.get('/login')
  const csrfToken = extractCsrfToken(res)
  res = await agent.post('/session').send({
    email: username,
    password,
    _csrf: csrfToken
  })
}

describe('Todo Application', function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true })
    server = app.listen(4000, () => {})
    agent = request.agent(server)
  })

  afterAll(async () => {
    try {
      await db.sequelize.close()
      await server.close()
    } catch (error) {
      console.log(error)
    }
  })

  test('Sign up', async () => {
    let res = await agent.get('/signup')
    const csrfToken = extractCsrfToken(res)
    res = await agent.post('/users').send({
      firstName: 'Test',
      lastName: 'User A',
      email: 'user.a@test.com',
      password: '12345678',
      _csrf: csrfToken
    })
    expect(res.statusCode).toBe(302)
  })

  test('Sign out', async () => {
    let res = await agent.get('/todos')
    expect(res.statusCode).toBe(200)
    res = await agent.get('/signout')
    expect(res.statusCode).toBe(302)
    res = await agent.get('/todos')
    expect(res.statusCode).toBe(302)
  })

  test('Creates a todo and responds with json at /todos POST endpoint', async () => {
    const agent = request.agent(server)
    await login(agent, 'user.a@test.com', '12345678')
    const res = await agent.get('/todos')
    const csrfToken = extractCsrfToken(res)
    const response = await agent.post('/todos').send({
      title: 'Buy milk',
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken
    })
    expect(response.statusCode).toBe(302)
  })

  test('updating a todo with the given ID as complete or not', async () => {
    const agent = request.agent(server)
    await login(agent, 'user.a@test.com', '12345678')
    let res = await agent.get('/todos')
    let csrfToken = extractCsrfToken(res)
    await agent.post('/todos').send({
      title: 'Buy chocolate',
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken
    })
    const groupedTodosResponse = await agent
      .get('/todos')
      .set('Accept', 'application/json')
      .set('Authorization', csrfToken)
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text)
    const dueTodayCount = parsedGroupedResponse.dueToday.length
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1]
    const completedStat = !latestTodo.completed
    res = await agent.get('/todos')
    csrfToken = extractCsrfToken(res)
    const markCompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: csrfToken,
        completed: completedStat
      })
    const parsedUpdateResponse = JSON.parse(markCompleteResponse.text)
    expect(parsedUpdateResponse.completed).toBe(true)
  })
  test('Fetches all todos in the database using /todos endpoint', async () => {
    const agent = request.agent(server)
    await login(agent, 'user.a@test.com', '12345678')
    let res = await agent.get('/todos')
    let csrfToken = extractCsrfToken(res)
    await agent.post('/todos').send({
      title: 'Buy xbox',
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken
    })
    const groupedTodosResponse1 = await agent
      .get('/todos')
      .set('Accept', 'application/json')
      .set('Authorization', csrfToken)
    const parsedGroupedResponse1 = JSON.parse(groupedTodosResponse1.text)
    const dueTodayCount1 = parsedGroupedResponse1.dueToday.length
    res = await agent.get('/todos')
    csrfToken = extractCsrfToken(res)
    await agent.post('/todos').send({
      title: 'Buy ps3',
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken
    })
    const groupedTodosResponse = await agent
      .get('/todos')
      .set('Accept', 'application/json')
      .set('Authorization', csrfToken)
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text)
    const dueTodayCount = parsedGroupedResponse.dueToday.length
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1]
    expect(dueTodayCount).toBe(dueTodayCount1 + 1)
    expect(latestTodo.title).toBe('Buy ps3')
  })

  test('Marking an item as incomplete', async () => {
    const agent = request.agent(server)
    await login(agent, 'user.a@test.com', '12345678')
    let res = await agent.get('/todos')
    let csrfToken = extractCsrfToken(res)
    await agent.post('/todos').send({
      title: 'Buy Banana',
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken
    })
    const groupedTodosResponse = await agent
      .get('/todos')
      .set('Accept', 'application/json')
      .set('Authorization', csrfToken)
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text)
    const dueTodayCount = parsedGroupedResponse.dueToday.length
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1]
    const completedStat = !latestTodo.completed
    res = await agent.get('/todos')
    csrfToken = extractCsrfToken(res)
    const changeT1 = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({ _csrf: csrfToken, completed: completedStat })
    const UpadteTodoItemParse = JSON.parse(changeT1.text)
    expect(UpadteTodoItemParse.completed).toBe(true)
    res = await agent.get('/todos')
    csrfToken = extractCsrfToken(res)
    const changeT2 = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({ _csrf: csrfToken, completed: !completedStat })
    const UpadteTodoItemParse2 = JSON.parse(changeT2.text)
    expect(UpadteTodoItemParse2.completed).toBe(false)
  })

  test('Deletes a todo with the given ID if it exists and sends a boolean response', async () => {
    const agent = request.agent(server)
    await login(agent, 'user.a@test.com', '12345678')
    let res = await agent.get('/todos')
    let csrfToken = extractCsrfToken(res)
    await agent.post('/todos').send({
      title: 'Buy Icecream',
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken
    })
    const groupedTodosResponse = await agent
      .get('/todos')
      .set('Accept', 'application/json')
      .set('Authorization', csrfToken)
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text)
    const dueTodayCount = parsedGroupedResponse.dueToday.length
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1]
    res = await agent.get('/todos')
    csrfToken = extractCsrfToken(res)
    const DeletedResponse = await agent.delete(`/todos/${latestTodo.id}`).send({
      _csrf: csrfToken
    })
    const parseRes = Boolean(DeletedResponse.text)
    expect(parseRes).toBe(true)
  })
})
